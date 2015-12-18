# meteor-authtokens

**Warning:** As of June 2nd 2015 this is WIP until further notice. Use at own risk.

This package provides a lightweight quota and authToken ecosystem for your meteor project.
It works well on defined client and server routes in combination with iron:router.

# install

This package is dependent on iron:router by EventedMind.
So please make sure you have the latest version of [iron-router](https://github.com/EventedMind/iron-router) package added to your project.
If not, go ahead and

`meteor add iron:router`

**Notice:** The authToken itself (you want to add to any client or server route with ?auth=`YOURAUTHTOKEN`) will be part of your Meteor.user() object - so make sure you have a Meteor user account package of your choice added to your project.
I have been testing with the standard `accounts-base` && `accounts-ui` packages

`meteor add accounts-base`

`meteor add accounts-ui`

`meteor add accounts-password` - or any other login service

`meteor add herrhelms:meteor-authtokens`


# setup
1.) Find a way so your users can create a `Meteor.user()` object for themselves. For instance with `accounts-ui` package mentioned above, embed `{{>loginButtons}}`somethere within your html.

2.) Add these settings somewhere outside `Meteor.isServer` or `Meteor.isServer` within your code

```js
if(Meteor.isServer) {
	APISetup.config({
		quotaRange:'month', 	// lifetime of quota
		quotaSize:1000,			// quota in above lifetime
		keyPrefixLength:2,		// authToken will be formated prefix.StrInG (i.E. ny.ASe24sa)
		keyStringLength:7,		// use these two fields to control length of authTokens
		useWhere:'onRun',		// hook where to excecute with iron:router (onRun||onBeforeAction||onAfterAction||onRerun)
		useOnly:[],				// filter functionality to ONLY SOME specific route(s)
		useExcept:[]			// filter functionality to ALL EXCEPT SOME specific route(s)
	});
}
```

3.) Define your routes (and ofc have the templates available for the client)

```js
// test authtoken access on client via route '/about'
Router.route('/about', {where: 'client'});

// test authtoken access on server via route '/download'
Router.route('/download', {where: 'server'}).get(function () {
  this.response.end('Yeah, get request working...\n');
});

```

4.) Find your ApiKey in `Meteor.user().profile.apiKey` - This of course should NOT be easily accessible in a production environment.
