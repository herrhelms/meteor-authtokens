APIStorage = new Meteor.Collection('apistorage');
APIStats = new Meteor.Collection('apistats');
APIHistory = new Meteor.Collection('apihistory');
APIAccess = new Meteor.Collection('apiaccess');

APISetup = {
    quotaRange: 'month',
    quotaSize: 1000,
    keyPrefixLength: 2,
    keyStringLength: 7,
    useWhere: 'onRun',
    useOnly: [],
    useExcept: ['front']
};

var route;
var filter;

if (APISetup.useOnly.length > 0) {
    filter = {only: APISetup.useOnly};
} else if (APISetup.useExcept.length > 0) {
    filter = {except: APISetup.useExcept};
}

if (Meteor.isClient) {
    var clientRequire = function() {
        var route = this;
        var authToken = route.params.query.key;
        if(!authToken || !route.params.query) {
            Blaze.renderWithData("401 - Request denied. AuthToken is missing!", null, document.body);
            route.stop();
        } else if(authToken == 0) {
            Blaze.renderWithData("401 - Request denied. AuthToken is missing!", null, document.body);
            route.stop();
        } else {
            Meteor.call('checkApiKey',authToken,function(err,res) {
                if(!err && res)  {
                    route.render();
                } else {
                    Blaze.renderWithData(err.reason, null, document.body);
                    route.stop();
                }
            });
        }
    }
    // helper fixing the onBeforeAction notice
    if(APISetup.useWhere == 'onRun'){
        Router.onBeforeAction(function() {
            console.log(this);
            this.next();
        });
    }
    if(!filter) {
        Router[APISetup.useWhere](clientRequire);
    } else {
        Router[APISetup.useWhere](clientRequire,filter);
    }
}

if (Meteor.isServer) {
    Meteor.startup(function() {
        Accounts.onCreateUser(function(options, user) {
            if (!user.profile) {
                user.profile = {apiKey: setApiKey(user._id), billingInfo: true};
            } else {
                Meteor.call('assignApiKey', user);
            }
            return user;
        });
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
                console.log('Middleware successfully called on server (' + APISetup.useWhere + ') with ' + req.method + ' of url: ', req.url);
                that.next();
            } else {
                res.end("401 - Request denied. AuthToken not found!");
            }
        }
    };

    Router[APISetup.useWhere](serverRequire, _.extend(filter, {where: 'server'}));
    var setApiKey = function(user) {
        var auth = Random.id(APISetup.keyPrefixLength).toLowerCase() + '.' + Random.id(APISetup.keyStringLength);

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

        if (APISetup.quotaRange === 'day') {
            shortName = moment().format('YYYY-MM-DD');
        } else if (APISetup.quotaRange === 'month') {
            shortName = moment().format('YYYY-MM');
        } else if (APISetup.quotaRange === 'year') {
            shortName = moment().format('YYYY');
        }

        var quotaObject = {
            rangeIn: moment().startOf(APISetup.quotaRange).toISOString(),
            rangeOut: moment().endOf(APISetup.quotaRange).toISOString(),
            rangePeriod: shortName,
            quotaSize: APISetup.quotaSize,
            quotaCount: APISetup.quotaSize
        };

        var apiid = APIStorage.insert(keyObject);

        APIHistory.insert({ref: apiid, action: 'add', type: 'token', msg: 'token.created', createdAt: moment().toISOString(), createdFor: user});
        APIStats.insert({ref: user, ranges: [quotaObject], isActive: true, createdAt: moment().toISOString()});
        return auth;
    };

    Meteor.methods({
        'quotaReset': function(range, owner, stats) {
            console.log('quota is gone for ...' + owner);
            console.log('@todo - resetting stats...');
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
            console.log('@todo - remove all users');
        },
        'checkApiKey': function(key) {
            var keyfound = APIStorage.findOne({auth: key});

            if (!keyfound && typeof keyfound === 'object') {
                var range = moment().format('YYYY-MM');
                var stats = APIStats.update({ref: keyfound.host, "ranges.rangePeriod": range}, {$inc: {"ranges.$.quotaCount": -1}});
                console.log(stats);

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

                    console.log('current currentCount.quotaCount left for ' + keyfound.host + ' = '+ currentCount.quotaCount) ;
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
