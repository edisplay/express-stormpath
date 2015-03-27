'use strict';
/**
 * @ngdoc overview
 * @name stormpath
 *
 * @description
 *
 *
 *
 * ## Welcome!  Let's get started
 *
 * You are reading the API documentation for the Stormpath AngularJS SDK,
 * you are moments away from sovling all kinds of user management issues
 * in your Angular application :)
 *
 * ## Installation - Bower
 *
 * If you are using [Bower](https://bower.io) you can simply install
 * our package:
 *
 * ```
 * bower install --save stormpath-sdk-angularjs
 * ```
 *
 * ## Installation - Manual
 *
 * If you would like to add the scripts manually, simply get the latest files from
 * the [dist folder on github](https://github.com/stormpath/stormpath-sdk-angularjs/tree/master/dist).
 * Then add them to the `<head>` section of your document:
 *
 * <pre>
 * <script src="stormpath-sdk-angularjs.min.js"></script>
 * <script src="stormpath-sdk-angularjs.tpls.min.js"></script>
 * </pre>
 *
 * ## Configuration
 *
 * You will need to add `stormpath` as a depenency of your Angular application,
 * and the templates if you will be using those:
 *
 * <pre>
 * <script>
 *   var myApp = angular.module('myApp', ['stormpath','stormpath.templates']);
 * </script>
 * </pre>
 *
 * ## Templates are optional
 *
 * This libray includes some default view templates for forms, such as
 * registration and login.  You have the option to specify your own templates
 * for those directives.  If you are using your own templates it does not make
 * sense to include our defaults.
 *
 * If you are using the manual installation: sipmply remove the file
 * `stormpath-sdk-angularjs.tpls.min.js`
 *
 * If you are using Bower, you can specify an override for this module
 * and only include the core javascript.  This is done inside your
 * `bower.json` file:
 *
 * <pre>
 * {
 *     // .. the rest of your bower.json ..
 *
 *   "overrides":{
 *     "stormpath-sdk-angularjs":{
 *       "main":[
 *         "dist/stormpath-sdk-angularjs.min.js"
 *       ]
 *     }
 * }
 * </pre>
 *
 */

/**
 * @ngdoc object
 * @name stormpath.SpStateConfig:SpStateConfig
 * @description
 * The Stormpath State Config is an object that you can define on a
 * state.  You will need to be using the UI Router module, and you need
 * to enable the integration by calling  {@link stormpath.$stormpath#methods_uiRouter $stormpath.uiRouter()}
 * @property {boolean} authenticate If `true`, the user must be
 * authenticated in order to view this state.  If the user is not authenticated they will
 * be redircted to the `login` state.  After they login they will be redicted to
 * the state that was originally requested.
 *
 * @property {object} authorize
 *
 * An object which defines access control rules.  Currently is supports a group-based
 * check.  See the example below
 *
 * @property {boolean} waitForUser If `true`, delay the state transition until we know
 * if the user is authenticated or not.  This is useful for situations where
 * you want everyone to see this state, but the state may look different
 * depending on the user's authentication state.
 *
 *
 * @example
 * <pre>
 *
 * angular.module('myApp')
 *   .config(function ($stateProvider) {
 *
 *     // Wait until we know if the user is logged in, before showing the homepage
 *     $stateProvider
 *       .state('main', {
 *         url: '/',
 *         sp: {
 *           waitForUser: true
 *         }
 *       });
 *
 *     // Require a user to be authenticated in order to see this state
 *     $stateProvider
 *       .state('secrets', {
 *         url: '/secrets',
 *         controller: 'SecretsCtrl',
 *         sp: {
 *           authenticate: true
 *         }
 *       });
 *
 *     // Require a user to be in the admins group in order to see this state
 *     $stateProvider
*       .state('secrets', {
 *         url: '/admin',
 *         controller: 'AdminCtrl',
 *         sp: {
 *           authorize: {
 *             group: ['admins']
 *           }
 *         }
 *       });
 * });
 * </pre>
 */
angular.module('stormpath',['stormpath.CONFIG','stormpath.auth','stormpath.userService'])
.provider('$stormpath', [function $stormpathProvider(){
  /**
   * @ngdoc object
   * @name stormpath.$stormpath
   * @description
   * This service allows you to enable application-wide features of the library.
   */

  this.$get = [
    '$user','$state','$cookieStore','STORMPATH_CONFIG','$rootScope',
    function stormpathServiceFactory($user,$state,$cookieStore,STORMPATH_CONFIG,$rootScope){

      function StormpathService(){
        return this;
      }
      StormpathService.prototype.stateChangeInterceptor = function stateChangeInterceptor() {
        $rootScope.$on('$stateChangeStart', function(e,toState,toParams){
          var sp = toState.sp || {}; // Grab the sp config for this state
          if((sp.authenticate || sp.authorize) && (!$user.currentUser)){
            e.preventDefault();
            $user.get().then(function(){
              // The user is authenticated, continue to the requested state
              $state.go(toState.name,toParams);
            },function(){
              // The user is not authenticated, emit the necessary event
              $rootScope.$broadcast(STORMPATH_CONFIG.STATE_CHANGE_UNAUTHENTICATED,toState,toParams);
            });
          }else if(sp.waitForUser && ($user.currentUser===null)){
            e.preventDefault();
            $user.get().finally(function(){
              $state.go(toState.name,toParams);
            });
          }
          else if($user.currentUser && sp.authorize){
            if((Object.keys(sp.authorize).length === 1) && sp.authorize.group){
              if(!$user.currentUser.inGroup(sp.authorize.group)){
                e.preventDefault();
                return $rootScope.$broadcast(STORMPATH_CONFIG.STATE_CHANGE_UNAUTHORIZED,toState,toParams);
              }
            }else{
              console.error('Unknown authorize configuration for state',toState);
            }
          }
        });
      };
      /**
       * @ngdoc function
       * @name stormpath#uiRouter
       * @methodOf stormpath.$stormpath
       * @description
       * Call this method to enable the integration with the UI Router module.
       *
       * When enabled you can define {@link stormpath.SpStateConfig:SpStateConfig Stormpath State Configurations} on your UI states, this
       * object allows you to define access control for the state.  See the
       * examples below
       *
       * @param {object} config
       * * **`loginState`** - The UI state name that we should send the user
       * to if they need to login.  You'll probably use `login` for this value
       *
       * * **`autoRedirect`** - Defaults to true.  After the user logins at
       * the state defined by `loginState` they will be redirected back to the
       * state that was originally requested
       *
       * * **`defaultPostLoginState`**  - Where the user should be sent, after login,
       * if they have visited the login page directly.  If you do not define a value,
       * nothing will happen at the login state.  You can alternatively use the
       * {@link stormpath.authService.$auth#events_$authenticated $authenticated} event to know
       * that login is successful
       *
       * @example
       * <pre>
       * angular.module('myApp')
       *   .run(function($stormpath){
       *     $stormpath.uiRouter({
       *       loginState: 'login',
       *       defaultPostLoginState: 'main'
       *     });
       *   })
       * </pre>
       */
      StormpathService.prototype.uiRouter = function uiRouter(config){
        var self = this;
        config = typeof config === 'object' ? config : {};
        this.stateChangeInterceptor();
        if(config.loginState){
          self.unauthenticatedWather = $rootScope.$on(STORMPATH_CONFIG.STATE_CHANGE_UNAUTHENTICATED,function(e,toState,toParams){
            self.postLogin = {toState:toState,toParams:toParams};
            $state.go(config.loginState);
            if(config.autoRedirect !== false){
              self.authWatcher = $rootScope.$on(STORMPATH_CONFIG.AUTHENTICATION_SUCCESS_EVENT_NAME,function(){
                self.authWatcher(); // unregister this watecher
                if(self.postLogin){
                  $state.go(self.postLogin.toState,self.postLogin.toParams).then(function(){
                    self.postLogin = null;
                  });
                }
              });
            }
          });
        }
        if(config.defaultPostLoginState){
          self.defaultRedirectStateWatcher = $rootScope.$on(STORMPATH_CONFIG.AUTHENTICATION_SUCCESS_EVENT_NAME,function(){
            if(!self.postLogin){
              $state.go(config.defaultPostLoginState);
            }
          });
        }
      };

      return new StormpathService();
    }
  ];
}])
.run(['$rootScope','$user',function($rootScope,$user){
  $rootScope.user = $user.currentUser || null;
  $user.get().finally(function(){
    $rootScope.user = $user.currentUser;
  });
  $rootScope.$on('$currentUser',function(e,user){
    $rootScope.user = user;
  });
  $rootScope.$on('$sessionEnd',function(){
    $rootScope.user = null;
  });
}])

/**
 * @ngdoc directive
 * @name stormpath.ifUser:if-user
 *
 * @description
 * Use this directive to conditionally show an element, if the user is logged in.
 *
 * @example
 * <pre>
 * <div class="container">
 *   <h3 if-user>Hello, {{user.fullName}}</h3>
 * </div>
 * </pre>
 */
.directive('ifUser',['$user','$rootScope',function($user,$rootScope){
  return {
    link: function(scope,element){
      $rootScope.$watch('user',function(user){
        if(user && user.href){
          element.show();
        }else{
          element.hide();
        }
      });
    }
  };
}])

/**
 * @ngdoc directive
 * @name stormpath.ifNotUser:if-not-user
 *
 * @description
 * Use this directive to conditionally show an element, if the user is NOT logged in.
 *
 * @example
 * <pre>
 * <div class="container">
 *   <h3 if-not-user>Hello, you need to login</h3>
 * </div>
 * </pre>
 */
.directive('ifNotUser',['$user','$rootScope',function($user,$rootScope){
  return {
    link: function(scope,element){
      $rootScope.$watch('user',function(user){
        if(user && user.href){
          element.hide();
        }else{
          element.show();
        }
      });
    }
  };
}])

/**
 * @ngdoc directive
 * @name stormpath.whileResolvingUser:while-resolving-user
 *
 * @description
 * Use this directive to show an element, while waiting to know if the user
 * is logged in or not.  This is useful if you want to show a loading graphic
 * over your application while you are waiting for the user state.
 *
 * @example
 * <pre>
 * <div while-resolving-user style="position:fixed;top:0;left:0;right:0;bottom:0;background-color:pink;">I wait for you</div>
 * </pre>
 */
.directive('whileResolvingUser',['$user',function($user){
  return {
    link: function(scope,element){
      $user.get().finally(function(){
        console.log('currentUser',$user.currentUser);
        if((typeof $user.currentUser ==='object') || ($user.currentUser===false)){
          element.hide();
        }else{
          element.show();
        }
      });
    }
  };
}])

/**
 * @ngdoc directive
 * @name stormpath.spLogout:spLogout
 *
 * @description
 * This directive adds a click handler to the element.  When clicked the user will be logged out.
 *
 * @example
 * <pre>
 *   <a ui-sref="main" sp-logout>Logout</a>
 * </pre>
 */
.directive('spLogout',['$auth',function($auth){
  return{
    link: function(scope,element){
      element.on('click',function(){
        $auth.endSession();
      });
    }
  };
}]);