/* ============================================================
   auth.js  ·  Registro, inicio de sesión y roles
   - El PRIMER usuario que se registra queda como DUEÑO.
   - El DUEÑO puede crear cuentas de VENDEDOR desde Configuración.
   - Contraseña guardada con hash (solo en el dispositivo).
   ============================================================ */
(function (global) {
  'use strict';

  var SESSION_KEY = 'centromire_session';

  function hash(str) {
    var h = 5381, i = str.length;
    while (i) { h = (h * 33) ^ str.charCodeAt(--i); }
    return (h >>> 0).toString(16) + ':' + str.length;
  }

  var Auth = {
    isFirstRun: function () { return Store.users().length === 0; },

    register: function (name, username, password, role) {
      username = (username || '').trim();
      if (!name || !username || !password) throw new Error('Completa todos los campos.');
      if (password.length < 4) throw new Error('La contraseña debe tener al menos 4 caracteres.');
      if (Store.findUser(username)) throw new Error('Ese usuario ya existe.');

      var finalRole = Store.users().length === 0 ? 'dueno' : (role || 'vendedor');
      var user = {
        id: Store.uid(),
        name: name.trim(),
        username: username,
        pass: hash(password),
        role: finalRole,
        createdAt: new Date().toISOString()
      };
      Store.addUser(user);
      return user;
    },

    login: function (username, password) {
      var u = Store.findUser(username);
      if (!u || u.pass !== hash(password)) throw new Error('Usuario o contraseña incorrectos.');
      localStorage.setItem(SESSION_KEY, u.id);
      return u;
    },

    logout: function () { localStorage.removeItem(SESSION_KEY); },

    current: function () {
      var id = localStorage.getItem(SESSION_KEY);
      if (!id) return null;
      return Store.users().find(function (u) { return u.id === id; }) || null;
    },

    isOwner: function () {
      var u = Auth.current();
      return !!u && u.role === 'dueno';
    },

    changePassword: function (userId, newPass) {
      if (!newPass || newPass.length < 4) throw new Error('La contraseña debe tener al menos 4 caracteres.');
      var u = Store.users().find(function (x) { return x.id === userId; });
      if (u) { u.pass = hash(newPass); Store.save(); }
    }
  };

  global.Auth = Auth;
})(window);
