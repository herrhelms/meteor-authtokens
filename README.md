# meteor-authtokens
This package provides a lightweight quota and authToken eco-system (ApiKeys) for your meteor project.
It depends and works well with `iron:router` on defined client and server routes.

## install
Please make sure you have the latest version of [iron-router](https://github.com/EventedMind/iron-router) package added to your project.
If not, go ahead and

`meteor add iron:router`

**Notice:** The authToken itself will be part of your Meteor.user() object - so make sure you have Meteor user account packages of your choice added to the project.
I have been testing with the standard `accounts-base` && `accounts-ui` packages

`meteor add accounts-base`

`meteor add accounts-ui`

`meteor add accounts-password` - or any other login service

`meteor add herrhelms:meteor-authtokens`

## setup
1.) Find a way so your users can create a `Meteor.user()` object. For instance when using `accounts-ui` package, embed `{{>loginButtons}}` somewhere within your html.

2.) Add the following settings somewhere outside `Meteor.isServer` or `Meteor.isServer` within your code and modify to your liking.

```js
if (Meteor.isServer) {
	APISetup.config({
		quotaRange: 'month', // lifetime of quota
		quotaSize: 1000, // quota in above lifetime
		keyPrefixLength: 2, // authTokens will be formated prefix.StrInG (ny.ASe24sa)
		keyStringLength: 7, // use these two fields to control complexity of authTokens
		useWhere: 'onRun', // hook where to excecute (onRun||onBeforeAction||onAfterAction||onRerun)
		useOnly:['download', 'about'], // filter to ONLY SOME specific route(s)
		useExcept:[], // use on ALL ROUTES EXCEPT SOME specific ones - EXCEPT will override ONLY(!)
		noKeyTemplate: null, // template to use client side if no ?key=
		wrongKeyTemplate: null, // template to use client side if wrong ?key=
    emptyQuotaTemplate: null // template to use client side, when current quota is gone
    resetQuotaLink: null // absolute URI where to reset / top-up current quota
  });
}
```

3.) Define some routes (and have the necessary templates available in client html)

```js
// test access client side via route '/about'
Router.route('/about', {where: 'client'});

// test access server side via route '/download'
Router.route('/download', {where: 'server'}).get(function () {
  this.response.end('Yeah, get request working...\n');
});
```

4.) Look for your personal ApiKey in `Meteor.user().profile.apiKey`

5.) Run `meteor remove autopublish` (You would not want to have that enabled in production evironment anyways.)

6.) Whenever calling a route that needs the ApiKey add **`?key=YOURAPIKEY`** to the URI.

## Next steps
Couple of things this package should learn in the near future... (WIP)

 - [ ] Admin views for quotas (role based - `alanning:roles@1.2.14`)
 - [ ] Defaults/Settings for different quota per role
 - [ ] Send optional emails if quota is almost empty (Define *almost*)
 - [x] predefined templates `_keyNotFound`, `_keyIsWrong`, `_quotaIsGone`,
