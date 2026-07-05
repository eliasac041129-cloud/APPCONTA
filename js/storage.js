/* ============================================================
   storage.js  ·  Capa de datos (localStorage, 100% en el dispositivo)
   Todo se guarda en el navegador del celular. No sale a internet.
   ============================================================ */
(function (global) {
  'use strict';

  var KEY = 'centromire_v1';

  var SERVICIOS_DEFAULT = [
    'Faciales (según el caso)', 'Hydrafacial', 'Depilación láser',
    'Eliminación de celulitis', 'Adiposidades localizadas', 'Dermapen',
    'Mesoterapia', 'Hidrolipoclasia (lipo sin bisturí)', 'Aplicación de enzimas',
    'Manejo de aparatología', 'Radiofrecuencia', 'Láser biolight',
    'Cavitador', 'Carboxiterapia', 'Dermatic', 'Ultrasonido'
  ];

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function fresh() {
    return {
      config: { businessName: 'CENTRO MIRE', ivaRate: 0.16, currency: 'MXN' },
      users: [],
      services: SERVICIOS_DEFAULT.map(function (n) {
        return { id: uid(), name: n, price: 0, taxed: true, active: true };
      }),
      products: [],
      sales: [],
      purchases: [],
      closures: []
    };
  }

  var DB = null;

  function load() {
    if (DB) return DB;
    try {
      var raw = localStorage.getItem(KEY);
      DB = raw ? JSON.parse(raw) : fresh();
    } catch (e) { DB = fresh(); }
    if (!DB.config) DB.config = fresh().config;
    if (typeof DB.config.ivaRate !== 'number') DB.config.ivaRate = 0.16;
    ['users', 'services', 'products', 'sales', 'purchases', 'closures'].forEach(function (k) {
      if (!Array.isArray(DB[k])) DB[k] = [];
    });
    return DB;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(DB)); }
    catch (e) { console.error('No se pudo guardar', e); }
  }

  var Store = {
    uid: uid,
    db: load,
    save: save,

    getConfig: function () { return load().config; },
    setConfig: function (patch) { Object.assign(load().config, patch); save(); },
    iva: function () { return load().config.ivaRate || 0; },

    users: function () { return load().users; },
    findUser: function (username) {
      var u = (username || '').trim().toLowerCase();
      return load().users.find(function (x) { return x.username.toLowerCase() === u; });
    },
    addUser: function (user) { load().users.push(user); save(); },
    removeUser: function (id) { DB.users = DB.users.filter(function (u) { return u.id !== id; }); save(); },

    services: function () { return load().services; },
    activeServices: function () { return load().services.filter(function (s) { return s.active !== false; }); },
    addService: function (s) {
      load().services.push({ id: uid(), name: s.name, price: +s.price || 0, taxed: s.taxed !== false, active: true });
      save();
    },
    updateService: function (id, patch) {
      var s = load().services.find(function (x) { return x.id === id; });
      if (s) { Object.assign(s, patch); save(); }
    },
    removeService: function (id) { DB.services = DB.services.filter(function (x) { return x.id !== id; }); save(); },

    products: function () { return load().products; },
    addProduct: function (p) {
      load().products.push({ id: uid(), name: p.name, price: +p.price || 0, stock: +p.stock || 0, taxed: p.taxed !== false, active: true });
      save();
    },
    updateProduct: function (id, patch) {
      var p = load().products.find(function (x) { return x.id === id; });
      if (p) { Object.assign(p, patch); save(); }
    },
    removeProduct: function (id) { DB.products = DB.products.filter(function (x) { return x.id !== id; }); save(); },

    sales: function () { return load().sales; },
    addSale: function (sale) {
      sale.id = uid();
      load().sales.unshift(sale);
      (sale.items || []).forEach(function (it) {
        if (it.type === 'producto') {
          var p = DB.products.find(function (x) { return x.id === it.refId; });
          if (p && typeof p.stock === 'number') p.stock = Math.max(0, p.stock - it.qty);
        }
      });
      save();
      return sale;
    },
    removeSale: function (id) { DB.sales = DB.sales.filter(function (x) { return x.id !== id; }); save(); },

    purchases: function () { return load().purchases; },
    addPurchase: function (p) { p.id = uid(); load().purchases.unshift(p); save(); return p; },
    removePurchase: function (id) { DB.purchases = DB.purchases.filter(function (x) { return x.id !== id; }); save(); },

    // ---- Cierres de mes (archivo de balances, NO destructivo) ----
    closures: function () { return load().closures; },
    getClosure: function (month) { return load().closures.find(function (c) { return c.month === month; }); },
    addClosure: function (c) {
      // Si ya existe un cierre de ese mes, se reemplaza (re-cierre)
      DB.closures = load().closures.filter(function (x) { return x.month !== c.month; });
      c.id = uid();
      DB.closures.push(c);
      DB.closures.sort(function (a, b) { return a.month < b.month ? 1 : -1; });
      save();
      return c;
    },
    removeClosure: function (month) {
      DB.closures = load().closures.filter(function (x) { return x.month !== month; });
      save();
    },

    exportJSON: function () { return JSON.stringify(load(), null, 2); },
    importJSON: function (text) { DB = JSON.parse(text); save(); },
    resetAll: function () { DB = fresh(); save(); }
  };

  global.Store = Store;
})(window);
