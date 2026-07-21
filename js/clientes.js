/* ============================================================
   clientes.js  ·  Apartado CLIENTES
   - Vista de clientes DERIVADA de las ventas existentes.
   - NO agrega datos nuevos ni modifica nada: solo agrupa las
     ventas por nombre de cliente para mostrar su historial:
       * cuánto ha gastado en total
       * cuántas visitas / compras
       * qué servicios y productos ha comprado
       * fechas (primera visita, última visita) y detalle
   - Como se calcula a partir de las ventas, los clientes
     antiguos (incluidos los de respaldos viejos) aparecen solos.
   ============================================================ */
(function (global) {
  'use strict';

  var Clientes = {};
  var filtro = '';

  // Clave para agrupar: nombre sin espacios extra y en minúsculas
  function keyOf(name) {
    return String(name || 'Cliente').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  // Agrupa TODAS las ventas por cliente y devuelve un arreglo ordenado
  Clientes._agrupar = function () {
    var sales = Store.sales();
    var map = {};

    sales.forEach(function (s) {
      var name = (s.clientName || 'Cliente').trim() || 'Cliente';
      var k = keyOf(name);
      if (!map[k]) {
        map[k] = {
          key: k,
          name: name,        // se conserva la escritura más reciente
          visits: 0,
          total: 0,
          iva: 0,
          firstDate: s.date,
          lastDate: s.date,
          servicios: {},      // nombre -> cantidad
          sales: []
        };
      }
      var c = map[k];
      c.visits++;
      c.total = UI.round2(c.total + (s.total || 0));
      c.iva = UI.round2(c.iva + (s.iva || 0));
      if (!c.firstDate || s.date < c.firstDate) c.firstDate = s.date;
      if (!c.lastDate || s.date > c.lastDate) c.lastDate = s.date;
      (s.items || []).forEach(function (it) {
        c.servicios[it.name] = (c.servicios[it.name] || 0) + (it.qty || 0);
      });
      c.sales.push(s);
    });

    var list = Object.keys(map).map(function (k) { return map[k]; });
    // Ordena por visita más reciente
    list.sort(function (a, b) { return a.lastDate < b.lastDate ? 1 : (a.lastDate > b.lastDate ? -1 : 0); });
    return list;
  };

  // Normaliza para comparar: sin acentos, minúsculas, espacios simples
  function norm(s) {
    return String(s || '').trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  // Distancia de edición (Levenshtein) para detectar errores de dedo
  function lev(a, b) {
    if (a === b) return 0;
    var la = a.length, lb = b.length;
    if (!la) return lb; if (!lb) return la;
    var prev = [], i, j;
    for (j = 0; j <= lb; j++) prev[j] = j;
    for (i = 1; i <= la; i++) {
      var cur = [i];
      for (j = 1; j <= lb; j++) {
        var cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      }
      prev = cur;
    }
    return prev[lb];
  }

  /* Devuelve clientes existentes parecidos a lo que se está escribiendo.
     Sirve para avisar antes de crear un duplicado por error de ortografía. */
  Clientes.sugerencias = function (input) {
    var qi = norm(input);
    if (qi.length < 2 || qi === 'cliente') return [];
    var res = [];
    Clientes._agrupar().forEach(function (c) {
      var n = norm(c.name);
      if (!n || n === 'cliente') return;
      var exact = n === qi;
      var contains = n.indexOf(qi) !== -1 || qi.indexOf(n) !== -1;
      var d = lev(n, qi);
      var umbral = qi.length <= 4 ? 1 : 2;   // nombres cortos: más estricto
      if (exact || contains || d <= umbral) {
        res.push({ name: c.name, visits: c.visits, lastDate: c.lastDate, exact: exact, orden: exact ? -1 : (contains ? 0 : d) });
      }
    });
    res.sort(function (a, b) { return a.orden - b.orden; });
    return res.slice(0, 5);
  };

  /* ---------------- Vista principal ---------------- */
  Clientes.render = function (view) {
    var todos = Clientes._agrupar();

    var totalClientes = todos.length;
    var totalHistorico = UI.round2(todos.reduce(function (a, c) { return a + c.total; }, 0));

    view.innerHTML =
      '<div class="page-head"><h1>Clientes</h1><span class="muted">' + totalClientes + ' en total</span></div>' +

      '<div class="note info">💡 <div>Aquí ves a cada cliente con <b>lo que compró, cuánto gastó y las fechas</b>. Se arma solo a partir de tus ventas; no hay que capturar nada aparte.</div></div>' +

      '<div class="stat-grid">' +
        '<div class="stat p"><div class="lbl">Clientes atendidos</div><div class="val">' + totalClientes + '</div></div>' +
        '<div class="stat b"><div class="lbl">Ventas históricas</div><div class="val">' + UI.money(totalHistorico) + '</div></div>' +
      '</div>' +

      '<label style="margin-top:14px">Buscar cliente</label>' +
      '<input id="cl-buscar" placeholder="Escribe un nombre. Ej. Yair" autocomplete="off" value="' + UI.esc(filtro) + '" />' +

      '<div class="section-title">Lista de clientes</div>' +
      '<div class="card" id="cl-list"></div>';

    var listBox = view.querySelector('#cl-list');
    var buscar = view.querySelector('#cl-buscar');
    buscar.oninput = function () {
      filtro = buscar.value;
      Clientes._pintarLista(listBox, todos, buscar.value);
    };

    Clientes._pintarLista(listBox, todos, filtro);

    // Mantener el cursor al final si venía con texto
    if (filtro) {
      buscar.focus();
      var val = buscar.value; buscar.value = ''; buscar.value = val;
    }
  };

  Clientes._pintarLista = function (box, list, filtroActual) {
    var q = (filtroActual || '').trim().toLowerCase();
    var data = q ? list.filter(function (c) { return c.name.toLowerCase().indexOf(q) !== -1; }) : list;

    if (!data.length) {
      box.innerHTML = '<div class="empty"><div class="big">🧑‍🤝‍🧑</div>' +
        (q ? 'Ningún cliente coincide con la búsqueda.' : 'Todavía no hay clientes. Aparecerán cuando registres ventas en Caja.') +
        '</div>';
      return;
    }

    box.innerHTML = data.map(function (c, i) {
      var visitas = c.visits + (c.visits === 1 ? ' visita' : ' visitas');
      return '<div class="row" data-cli="' + i + '" style="cursor:pointer">' +
        '<div class="r-main">' +
          '<div class="r-title">' + UI.esc(c.name) + '</div>' +
          '<div class="r-sub">' + visitas + ' · última: ' + UI.fmtDate(c.lastDate) + '</div>' +
        '</div>' +
        '<div class="r-amt">' + UI.money(c.total) +
          '<span class="mini-btn" style="margin-top:6px;display:block">Ver ›</span>' +
        '</div>' +
      '</div>';
    }).join('');

    box.querySelectorAll('[data-cli]').forEach(function (row) {
      row.onclick = function () { Clientes._detalle(data[+row.getAttribute('data-cli')]); };
    });
  };

  /* ---------------- Detalle de un cliente ---------------- */
  Clientes._detalle = function (c) {
    if (!c) return;

    // Servicios más comprados (ordenados por cantidad)
    var servList = Object.keys(c.servicios)
      .sort(function (a, b) { return c.servicios[b] - c.servicios[a]; })
      .map(function (n) {
        return '<div class="total-line"><span>' + UI.esc(n) + '</span><b>' + c.servicios[n] + '×</b></div>';
      }).join('') || '<p class="muted" style="font-size:14px">Sin servicios registrados.</p>';

    // Historial de visitas (ventas), de la más reciente a la más antigua
    var ventas = c.sales.slice().sort(function (a, b) { return a.date < b.date ? 1 : (a.date > b.date ? -1 : 0); });
    var histo = ventas.map(function (s) {
      var items = (s.items || []).map(function (i) { return i.qty + '× ' + i.name; }).join(', ');
      var ivaBadge = s.taxed
        ? '<span class="pill iva">IVA ' + UI.money(s.iva || 0) + '</span>'
        : '<span class="pill noiva">Sin IVA</span>';
      var fact = s.invoiced ? '<span class="pill fact">Facturada</span>' : '';
      var metodo = s.method ? '<span class="pill ' + s.method + '">' + Negocio._methodLabel(s.method) + '</span> ' : '';
      return '<div class="row">' +
        '<div class="r-main">' +
          '<div class="r-title" style="font-size:14px">' + UI.fmtDate(s.date) + '</div>' +
          '<div class="r-sub">' + UI.esc(items || '—') + '</div>' +
          '<div class="r-sub" style="margin-top:4px">' + metodo + ivaBadge + ' ' + fact + '</div>' +
        '</div>' +
        '<div class="r-amt">' + UI.money(s.total) + '</div>' +
      '</div>';
    }).join('');

    var body =
      '<div class="stat-grid">' +
        '<div class="stat p"><div class="lbl">Total gastado</div><div class="val">' + UI.money(c.total) + '</div></div>' +
        '<div class="stat b"><div class="lbl">Visitas</div><div class="val">' + c.visits + '</div></div>' +
      '</div>' +

      '<div class="card" style="margin-top:12px">' +
        '<div class="total-line"><span>Primera visita</span><b>' + UI.fmtDate(c.firstDate) + '</b></div>' +
        '<div class="total-line"><span>Última visita</span><b>' + UI.fmtDate(c.lastDate) + '</b></div>' +
        '<div class="total-line"><span>IVA cobrado (histórico)</span><b>' + UI.money(c.iva) + '</b></div>' +
        '<div class="total-line grand"><span>Ticket promedio</span><b>' + UI.money(c.visits ? UI.round2(c.total / c.visits) : 0) + '</b></div>' +
      '</div>' +

      '<div class="section-title">Servicios y productos comprados</div>' +
      '<div class="card">' + servList + '</div>' +

      '<div class="section-title">Historial de visitas</div>' +
      '<div class="card">' + histo + '</div>';

    UI.modal(c.name, body);
  };

  global.Clientes = Clientes;
})(window);
