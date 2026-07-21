/* ============================================================
   app.js  ·  Controlador principal
   - Pantallas de registro / inicio de sesión
   - Navegación por pestañas según el rol
   ============================================================ */
(function (global) {
  'use strict';

  var App = {};
  var currentTab = 'caja';

  function tabsFor(user) {
    var base = [
      { id: 'caja', label: 'Caja', ic: '🧾' },
      { id: 'clientes', label: 'Clientes', ic: '🧑‍🤝‍🧑' },
      { id: 'catalogo', label: 'Catálogo', ic: '💠' }
    ];
    if (user.role === 'dueno') {
      base.push({ id: 'dueno', label: 'Dueño', ic: '👤' });
      base.push({ id: 'config', label: 'Config', ic: '⚙️' });
    }
    return base;
  }

  App.start = function () {
    var user = Auth.current();
    if (!user) { App.renderAuth(); return; }
    App.renderApp(user);
  };

  App.renderAuth = function () {
    document.getElementById('app').classList.add('hidden');
    document.getElementById('auth-screen').classList.remove('hidden');
    if (Auth.isFirstRun()) App._registerFirst();
    else App._loginForm();
  };

  App._registerFirst = function () {
    var box = document.getElementById('auth-content');
    box.innerHTML =
      '<div class="note info">👋 <div>¡Bienvenida! Crea la cuenta del <b>Dueño</b> para empezar. Esta cuenta tendrá acceso a todo.</div></div>' +
      '<label>Tu nombre</label><input id="r-name" placeholder="Nombre del dueño" />' +
      '<label>Usuario</label><input id="r-user" autocomplete="off" placeholder="ej. mire" />' +
      '<label>Contraseña</label><input id="r-pass" type="password" placeholder="mínimo 4 caracteres" />' +
      '<button class="btn" id="r-go">Crear cuenta y entrar</button>';
    box.querySelector('#r-go').onclick = function () {
      try {
        var u = Auth.register(
          box.querySelector('#r-name').value,
          box.querySelector('#r-user').value,
          box.querySelector('#r-pass').value,
          'dueno'
        );
        Auth.login(u.username, box.querySelector('#r-pass').value);
        UI.toast('¡Cuenta creada! Bienvenida 🎉', 'ok');
        App.start();
      } catch (e) { UI.toast(e.message, 'err'); }
    };
  };

  App._loginForm = function () {
    var box = document.getElementById('auth-content');
    box.innerHTML =
      '<label>Usuario</label><input id="l-user" autocomplete="off" />' +
      '<label>Contraseña</label><input id="l-pass" type="password" />' +
      '<button class="btn" id="l-go">Entrar</button>';
    function tryLogin() {
      try {
        Auth.login(box.querySelector('#l-user').value, box.querySelector('#l-pass').value);
        App.start();
      } catch (e) { UI.toast(e.message, 'err'); }
    }
    box.querySelector('#l-go').onclick = tryLogin;
    box.querySelector('#l-pass').addEventListener('keydown', function (e) { if (e.key === 'Enter') tryLogin(); });
  };

  App.renderApp = function (user) {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');

    var cfg = Store.getConfig();
    document.getElementById('tb-business').textContent = cfg.businessName;
    document.getElementById('tb-user').textContent = user.name + ' · ' + (user.role === 'dueno' ? 'Dueño' : 'Vendedor');

    document.getElementById('btn-logout').onclick = function () {
      Auth.logout(); currentTab = 'caja'; App.start();
    };

    var tabs = tabsFor(user);
    if (!tabs.find(function (t) { return t.id === currentTab; })) currentTab = 'caja';
    var tabbar = document.getElementById('tabbar');
    tabbar.innerHTML = tabs.map(function (t) {
      return '<button class="tab ' + (t.id === currentTab ? 'active' : '') + '" data-tab="' + t.id + '">' +
        '<span class="tab-ic">' + t.ic + '</span>' + t.label + '</button>';
    }).join('');
    tabbar.querySelectorAll('.tab').forEach(function (b) {
      b.onclick = function () { currentTab = b.getAttribute('data-tab'); App.render(); };
    });

    App.render();
  };

  App.render = function () {
    var user = Auth.current();
    if (!user) { App.start(); return; }

    document.getElementById('tb-business').textContent = Store.getConfig().businessName;

    var tabs = tabsFor(user);
    if (!tabs.find(function (t) { return t.id === currentTab; })) currentTab = 'caja';
    document.querySelectorAll('.tab').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === currentTab);
    });

    var view = document.getElementById('view');
    view.scrollTop = 0;
    window.scrollTo(0, 0);

    if ((currentTab === 'dueno' || currentTab === 'config') && user.role !== 'dueno') {
      currentTab = 'caja';
    }

    switch (currentTab) {
      case 'caja': Negocio.renderCaja(view); break;
      case 'clientes': Clientes.render(view); break;
      case 'catalogo': Negocio.renderCatalogo(view); break;
      case 'dueno': Dueno.render(view); break;
      case 'config': Config.render(view); break;
      default: Negocio.renderCaja(view);
    }
  };

  global.App = App;
  document.addEventListener('DOMContentLoaded', App.start);
})(window);
