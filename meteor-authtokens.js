APIStorage = new Meteor.Collection('apistorage');
APIStats = new Meteor.Collection('apistats');
APIHistory = new Meteor.Collection('apihistory');
APIAccess = new Meteor.Collection('apiaccess');

var route;
var filter;

APISetup = {
  settings: {
  },
  config: function(config) {
    this.settings = _.extend(this.settings, config);
  }
};
this.APISetup = APISetup;

if (Meteor.isClient) {
  Meteor.startup(function () {
    if (APISetup.settings.useOnly && APISetup.settings.useOnly.length > 0) {
      filter = {only: APISetup.settings.useOnly};
    } else if (APISetup.settings.useExcept && APISetup.settings.useExcept.length > 0) {
      filter = {except: APISetup.settings.useExcept};
    }
    // helper fixing the onBeforeAction notice
    if (APISetup.settings.useWhere === 'onRun') {
      Router.onBeforeAction(function() {
        this.next();
      });
    }
    if (APISetup.settings.useWhere && !filter) {
      Router[APISetup.settings.useWhere](clientRequire);
    } else if (APISetup.settings.useWhere && filter){
      Router[APISetup.settings.useWhere](clientRequire, filter);
    }
  });

  var clientRequire = function() {
    var route = this;
    var authToken = route.params.query.key;
    if (!authToken || !route.params.query) {
      Blaze.renderWithData("401 - Request denied. AuthToken is missing!", null, document.body);
      route.stop();
    } else if (authToken === 0) {
      Blaze.renderWithData("401 - Request denied. AuthToken is missing!", null, document.body);
      route.stop();
    } else {
      Meteor.call('checkApiKey', authToken, function(err, res) {
        if (!err && res) {
          route.render();
          // @todo - decrease access quota
        } else {
          Blaze.renderWithData(err.reason, null, document.body);
          route.stop();
        }
      });
    }
  };
}

if (Meteor.isServer) {
    Meteor.startup(function() {
      if (APISetup.settings && APISetup.settings.useOnly && APISetup.settings.useOnly.length > 0) {
        filter = {only: APISetup.settings.useOnly};
      } else if (APISetup.settings && APISetup.settings.useExcept && APISetup.settings.useExcept.length > 0) {
        filter = {except: APISetup.settings.useExcept};
      }

      Accounts.onCreateUser(function(options, user) {
        if (!user.profile) {
          user.profile = {apiKey: setApiKey(user._id), billingInfo: false};
        } else {
          Meteor.call('assignApiKey', user);
        }
        return user;
      });

      if (APISetup.settings.useWhere && serverRequire) {
        Router[APISetup.settings.useWhere](serverRequire, _.extend(filter, {where: 'server'}));
      }
    });

    var serverRequire = function(req, res, next) {
      var query = this.params.query;
      var that = this;
      if (!query.key) {
        res.end("401 - Request denied. AuthToken is missing!");
      } else if (query.key.length === 0) {
        res.end("401 - Request denied. AuthToken is missing!");
      } else {
        var hasApiKey = APIStorage.findOne({auth: query.key});
        if (hasApiKey && typeof hasApiKey === 'object') {
          // console.log('Middleware successfully called on server (' + APISetup.settings.useWhere + ') with ' + req.method + ' of url: ' + req.url + ' using key ' + query.key);
          // @todo - decrease access quota
          that.next();
        } else {
          res.end("401 - Request denied. AuthToken not found!");
        }
      }
    };

    var setApiKey = function(user) {
      var auth = Random.id(APISetup.settings.keyPrefixLength).toLowerCase() + '.' + Random.id(APISetup.settings.keyStringLength);

      var checkIfActive = function() {
        var activeUser = Meteor.users.find({_id: user});
        return activeUser.profile.billingInfo || false;
      };

      var keyObject = {
        createdAt: moment().toISOString(),                                          // createdAt
        isActive: checkIfActive,                                                    // access yes/no?
        isBlocked: false,                                                           // temporary block yes/no?
        refreshKey: moment().add(1, 'month').subtract(1, 'day').toISOString(),      // when to recheck for activation?
        salt: Random.secret(6),                                                     // referencing salt for API key against?
        host: user,                                                                 // ¿que?
        auth: auth                                                                  // referencing user ID or EMAIL to compare API key against?
      };

      var shortName = null;

      if (APISetup.settings.quotaRange === 'day') {
        shortName = moment().format('YYYY-MM-DD');
      } else if (APISetup.settings.quotaRange === 'month') {
        shortName = moment().format('YYYY-MM');
      } else if (APISetup.settings.quotaRange === 'year') {
        shortName = moment().format('YYYY');
      }

      var quotaObject = {
        rangeIn: moment().startOf(APISetup.settings.quotaRange).toISOString(),
        rangeOut: moment().endOf(APISetup.settings.quotaRange).toISOString(),
        rangePeriod: shortName,
        quotaSize: APISetup.settings.quotaSize,
        quotaCount: APISetup.settings.quotaSize
      };

      var apiid = APIStorage.insert(keyObject);

      APIHistory.insert({ref: apiid, action: 'add', type: 'token', msg: 'token.created', createdAt: moment().toISOString(), createdFor: user});
      APIStats.insert({ref: user, ranges: [quotaObject], isActive: true, createdAt: moment().toISOString()});

      return auth;
    };

    Meteor.methods({
      'quotaReset': function(range, owner, stats) {
        console.log('quota is gone for ...' + owner);
        // console.log('@todo - resetting stats...');
      },
      'checkQuota': function(storageid) {
        var keyfound = APIStorage.findOne(storageid);
        return keyfound.quotas;
      },
      'resetAll': function() {
        APIStorage.remove({});
        APIStats.remove({});
        APIHistory.remove({});
        APIAccess.remove({});
        // console.log('@todo - remove all users.profile.apiKey');
      },
      'checkApiKey': function(key) {
        var keyfound = APIStorage.findOne({auth: key});

        if (!keyfound && typeof keyfound === 'object') {
          var range = moment().format('YYYY-MM');
          var stats = APIStats.update({ref: keyfound.host, "ranges.rangePeriod": range}, {$inc: {"ranges.$.quotaCount": -1}});
          var count = APIStats.find({ref: keyfound.host, "ranges.rangePeriod": range}, {fields: {"ranges.$": 1}}).fetch();
          var currentCount = _.findWhere(count[0].ranges, {rangePeriod: range});

          if (currentCount && currentCount.quotaCount >= 1) {
            var day = moment().format('YYYY-MM-DD');
            var accesslog = APIAccess.find({ref: keyfound.host, "log.day": day}, {fields: {"log.$": 1}}).fetch();
            // APIAccess.insert({ref:user, log:[quotaObject], createdAt:moment().toISOString()});
            if (!accesslog) {
              console.log('no accesslog for ' + day);
            } else {
              console.log(accesslog);
            }
            // var access = APIStats.update({ref:keyfound.host, "log.day":day},{$inc:{"log.$.count":1}});
            // console.log(count);
            console.log('current currentCount.quotaCount left for ' + keyfound.host + ' = ' + currentCount.quotaCount);

            return keyfound.auth;
          } else {
            throw new Meteor.Error(401, '401 - Request denied. Quota limit exceeded!');
          }
        } else {
          throw new Meteor.Error(401, '401 - Request denied. AuthToken not found!');
        }
      }
  });
}


