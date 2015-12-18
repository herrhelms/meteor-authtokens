Package.describe({
    name: 'herrhelms:meteor-authtokens',
    summary: 'AuthToken and quota middleware for meteor.users() working with iron:router routes.',
    version: '0.0.1',
    git: 'https://github.com/herrhelms/meteor-authtokens.git'
});

Package.onUse(function(api) {
    api.versionsFrom('1.0.2.1');
    api.use(['momentjs:moment@2.9.0', 'underscore', 'random']);
    api.imply('iron:router')
    api.addFiles('meteor-authtokens.js');
    api.export(['APISetup']);
});
