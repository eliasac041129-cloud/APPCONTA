/* ============================================================
   negocio.js  ·  Apartado NEGOCIO (caja diaria)
   - Nueva venta con carrito (servicios y productos)
   - Método de pago con desglose de IVA:
       * Efectivo  -> opción Gravado / No gravado de IVA
       * Tarjeta / Transferencia -> SIEMPRE incluye IVA
   - Recordatorio "No olvides cobrar el IVA"
   - Catálogo con botones Agregar servicio / Agregar producto
   ============================================================ */
(function (global) {
  'use strict';

  var Negocio = {};

  /* ---------------- CAJA (dashboard + ventas) ---------------- */
  Negocio.renderCaja = function (view) {
    var mkey = UI.currentMonth();
    var sales = Store.sales();
    var today = UI.todayISO();

    var todaySales = sales.filter(function (s) { return s.date === today; });
    var monthSales = sales.filter(function (s) { return UI.monthKey(s.date) === mkey; });

    var sum = function (arr, f) { return arr.reduce(function (a, x) { return a + f(x); }, 0); };

    var totHoy = sum(todaySales, function (s) { return s.total; });
    var ivaHoy = sum(todaySales, function (s) { return s.iva || 0; });

    var efectivo = UI.round2(sum(todaySales, function (s) { return s.method === 'efectivo' ? s.total : 0; }));
    var tarjeta = UI.round2(sum(todaySales, function (s) { return s.method === 'tarjeta' ? s.total : 0; }));
    var transfer = UI.round2(sum(todaySales, function (s) { return s.method === 'transferencia' ? s.total : 0; }));
    var gravado = UI.round2(sum(todaySales, function (s) { return s.taxed ? s.total : 0; }));
    var noGravado = UI.round2(sum(todaySales, function (s) { return s.taxed ? 0 : s.total; }));
    var ivaPct = Store.iva() * 100;

    view.innerHTML =
      '<div class="page-head"><h1>Caja</h1><span class="muted">' + UI.fmtDate(today) + '</span></div>' +

      '<div class="stat-grid">' +
        '<div class="stat p"><div class="lbl">Ventas de hoy</div><div class="val">' + UI.money(totHoy) + '</div></div>' +
        '<div class="stat b"><div class="lbl">Ventas del mes</div><div class="val">' + UI.money(sum(monthSales, function (s) { return s.total; })) + '</div></div>' +
      '</div>' +

      '<button class="btn" id="btn-nueva-venta" style="margin-top:14px">+ Nueva venta</button>' +

      '<div class="card" style="margin-top:16px">' +
        '<h3>Corte de caja de hoy</h3>' +
        '<div class="total-line"><span>💵 Efectivo</span><b>' + UI.money(efectivo) + '</b></div>' +
        '<div class="total-line"><span>💳 Tarjeta</span><b>' + UI.money(tarjeta) + '</b></div>' +
        '<div class="total-line"><span>🏦 Transferencia</span><b>' + UI.money(transfer) + '</b></div>' +
        '<div class="divider"></div>' +
        '<div class="total-line"><span>Gravado (con IVA)</span><b>' + UI.money(gravado) + '</b></div>' +
        '<div class="total-line"><span>No gravado (sin IVA)</span><b>' + UI.money(noGravado) + '</b></div>' +
        '<div class="total-line"><span>IVA cobrado (' + ivaPct.toFixed(0) + '%)</span><b>' + UI.money(ivaHoy) + '</b></div>' +
        '<div class="total-line grand"><span>Total neto hoy</span><b>' + UI.money(totHoy) + '</b></div>' +
      '</div>' +

      '<div class="section-title">Ventas de hoy</div>' +
      '<div class="card" id="ventas-hoy"></div>';

    view.querySelector('#btn-nueva-venta').onclick = Negocio.openVenta;
    Negocio._renderVentasList(view.querySelector('#ventas-hoy'), todaySales);
  };

  Negocio._renderVentasList = function (box, list) {
    if (!list.length) {
      box.innerHTML = '<div class="empty"><div class="big">🧾</div>No hay ventas registradas todavía.</div>';
      return;
    }
    box.innerHTML = list.map(function (s) {
      var items = (s.items || []).map(function (i) { return i.qty + '× ' + i.name; }).join(', ');
      var ivaBadge = s.taxed
        ? '<span class="pill iva">IVA ' + UI.money(s.iva || 0) + '</span>'
        : '<span class="pill noiva">Sin IVA</span>';
      var fact = s.invoiced ? '<span class="pill fact">Facturada</span>' : '';
      return '<div class="row">' +
        '<div class="r-main">' +
          '<div class="r-title">' + UI.esc(s.clientName || 'Cliente') + '</div>' +
          '<div class="r-sub">' + UI.esc(items) + '</div>' +
          '<div class="r-sub" style="margin-top:4px">' +
            '<span class="pill ' + s.method + '">' + Negocio._methodLabel(s.method) + '</span> ' +
            ivaBadge + ' ' + fact +
          '</div>' +
        '</div>' +
        '<div class="r-amt">' + UI.money(s.total) +
          '<button class="mini-btn del" data-del="' + s.id + '" style="margin-top:6px;display:block">Borrar</button>' +
        '</div>' +
      '</div>';
    }).join('');

    box.querySelectorAll('[data-del]').forEach(function (b) {
      b.onclick = function () {
        UI.confirm('¿Borrar esta venta? No se puede deshacer.', function () {
          Store.removeSale(b.getAttribute('data-del'));
          UI.toast('Venta borrada');
          App.render();
        }, 'Sí, borrar');
      };
    });
  };

  Negocio._methodLabel = function (m) {
    return m === 'efectivo' ? 'Efectivo' : m === 'tarjeta' ? 'Tarjeta' : 'Transferencia';
  };

  /* ---------------- NUEVA VENTA (modal con carrito) ---------------- */
  Negocio.openVenta = function () {
    var cart = [];
    var method = 'efectivo';
    var efectivoGravado = false;
    var invoiced = false;

    var body =
      '<div class="note info">💡 <div><b>No olvides cobrar el IVA</b> cuando el cliente pida factura o pague con tarjeta/transferencia.</div></div>' +
      '<label>Nombre del cliente</label>' +
      '<input id="v-cliente" placeholder="Ej. María López" autocomplete="off" />' +
      '<div id="v-cli-sug"></div>' +
      '<label>Fecha</label>' +
      '<input id="v-fecha" type="date" value="' + UI.todayISO() + '" />' +
      '<label>Agregar servicio o producto</label>' +
      '<div id="v-catalogo" class="chip-grid"></div>' +
      '<div id="v-cart-box" style="margin-top:14px"></div>' +
      '<label>Método de pago</label>' +
      '<div class="seg" id="v-metodo">' +
        '<button data-m="efectivo" class="on">💵 Efectivo</button>' +
        '<button data-m="tarjeta">💳 Tarjeta</button>' +
        '<button data-m="transferencia">🏦 Transfer.</button>' +
      '</div>' +
      '<div id="v-iva-opt"></div>' +
      '<label style="display:flex;align-items:center;gap:8px;margin-top:14px">' +
        '<input type="checkbox" id="v-fact" style="width:auto" /> Esta venta se facturó (CFDI)</label>' +
      '<div class="card" id="v-resumen" style="margin-top:14px;background:var(--primary-light)"></div>' +
      '<button class="btn green" id="v-guardar">Guardar venta</button>';

    UI.modal('Nueva venta', body, function (m, close) {
      var catBox = m.querySelector('#v-catalogo');
      var cartBox = m.querySelector('#v-cart-box');
      var ivaOpt = m.querySelector('#v-iva-opt');
      var resumen = m.querySelector('#v-resumen');

      var opciones = [];
      Store.activeServices().forEach(function (s) { opciones.push({ type: 'servicio', ref: s }); });
      Store.products().filter(function (p) { return p.active !== false; }).forEach(function (p) { opciones.push({ type: 'producto', ref: p }); });

      catBox.innerHTML = opciones.map(function (o, idx) {
        var badge = o.type === 'producto' ? ' 📦' : '';
        return '<button type="button" class="chip" data-idx="' + idx + '">' +
          UI.esc(o.ref.name) + badge +
          '<span class="chip-price">' + UI.money(o.ref.price) + '</span></button>';
      }).join('') || '<p class="muted">No hay servicios ni productos. Agrégalos en Catálogo.</p>';

      catBox.querySelectorAll('.chip').forEach(function (chip) {
        chip.onclick = function () {
          var o = opciones[+chip.getAttribute('data-idx')];
          var existing = cart.find(function (c) { return c.refId === o.ref.id; });
          if (existing) { existing.qty++; }
          else { cart.push({ type: o.type, refId: o.ref.id, name: o.ref.name, unitPrice: o.ref.price, qty: 1 }); }
          draw();
        };
      });

      m.querySelectorAll('#v-metodo button').forEach(function (btn) {
        btn.onclick = function () {
          m.querySelectorAll('#v-metodo button').forEach(function (b) { b.classList.remove('on'); });
          btn.classList.add('on');
          method = btn.getAttribute('data-m');
          drawIvaOpt();
          draw();
        };
      });

      m.querySelector('#v-fact').onchange = function (e) { invoiced = e.target.checked; };

      /* --- Sugerencia anti-duplicados: detecta clientes ya existentes --- */
      var clienteEl = m.querySelector('#v-cliente');
      var sugBox = m.querySelector('#v-cli-sug');
      function drawSug() {
        var sug = (global.Clientes ? Clientes.sugerencias(clienteEl.value) : []);
        if (!sug.length) { sugBox.innerHTML = ''; return; }
        var exact = sug.filter(function (s) { return s.exact; })[0];
        if (exact) {
          sugBox.innerHTML = '<div class="note ok" style="margin-top:8px">✅ <div>Ya tienes registrado a <b>' +
            UI.esc(exact.name) + '</b> (' + exact.visits + (exact.visits === 1 ? ' visita' : ' visitas') +
            '). Esta venta se sumará a su historial.</div></div>';
          return;
        }
        var chips = sug.map(function (s) {
          return '<button type="button" class="chip" data-name="' + UI.esc(s.name) + '">' +
            UI.esc(s.name) + '<span class="chip-price">' + s.visits + (s.visits === 1 ? ' visita' : ' visitas') + '</span></button>';
        }).join('');
        sugBox.innerHTML =
          '<div class="note warn" style="margin-top:8px">🔎 <div><b>¿Te refieres a un cliente que ya existe?</b> ' +
          'Para no duplicarlo por un error de escritura, tócalo y se usará el mismo nombre.</div></div>' +
          '<div class="chip-grid">' + chips + '</div>';
        sugBox.querySelectorAll('[data-name]').forEach(function (b) {
          b.onclick = function () { clienteEl.value = b.getAttribute('data-name'); drawSug(); };
        });
      }
      clienteEl.addEventListener('input', drawSug);

      function drawIvaOpt() {
        if (method === 'efectivo') {
          ivaOpt.innerHTML =
            '<div class="note warn">🧾 <div>Pago en <b>efectivo</b>: elige si esta venta lleva IVA o no.</div></div>' +
            '<div class="seg" id="v-grav">' +
              '<button data-g="0" class="' + (efectivoGravado ? '' : 'on') + '">Sin IVA</button>' +
              '<button data-g="1" class="' + (efectivoGravado ? 'on' : '') + '">Gravado (con IVA)</button>' +
            '</div>';
          ivaOpt.querySelectorAll('#v-grav button').forEach(function (b) {
            b.onclick = function () { efectivoGravado = b.getAttribute('data-g') === '1'; drawIvaOpt(); draw(); };
          });
        } else {
          ivaOpt.innerHTML = '<div class="note ok">✅ <div>Pago con <b>' + Negocio._methodLabel(method) + '</b>: <b>incluye IVA</b> (' + (Store.iva() * 100).toFixed(0) + '%).</div></div>';
        }
      }

      function isTaxed() { return method === 'efectivo' ? efectivoGravado : true; }

      function draw() {
        if (!cart.length) {
          cartBox.innerHTML = '<p class="muted" style="font-size:14px">Toca un servicio o producto para agregarlo.</p>';
        } else {
          cartBox.innerHTML = cart.map(function (c, i) {
            return '<div class="cart-item">' +
              '<div class="r-main"><div class="r-title" style="font-size:14px">' + UI.esc(c.name) + '</div>' +
              '<div class="r-sub">' + UI.money(c.unitPrice) + ' c/u</div></div>' +
              '<div class="qty">' +
                '<button data-dec="' + i + '">−</button><span>' + c.qty + '</span><button data-inc="' + i + '">+</button>' +
                '<b style="min-width:70px;text-align:right">' + UI.money(c.unitPrice * c.qty) + '</b>' +
              '</div></div>';
          }).join('');
          cartBox.querySelectorAll('[data-inc]').forEach(function (b) {
            b.onclick = function () { cart[+b.getAttribute('data-inc')].qty++; draw(); };
          });
          cartBox.querySelectorAll('[data-dec]').forEach(function (b) {
            b.onclick = function () {
              var i = +b.getAttribute('data-dec');
              cart[i].qty--; if (cart[i].qty <= 0) cart.splice(i, 1);
              draw();
            };
          });
        }

        var total = cart.reduce(function (a, c) { return a + c.unitPrice * c.qty; }, 0);
        var d = UI.desglosar(total, isTaxed());
        resumen.innerHTML =
          '<div class="total-line"><span>Subtotal (base)</span><b>' + UI.money(d.base) + '</b></div>' +
          '<div class="total-line"><span>IVA</span><b>' + UI.money(d.iva) + '</b></div>' +
          '<div class="total-line grand"><span>Total a cobrar</span><b>' + UI.money(d.total) + '</b></div>';
      }

      drawIvaOpt();
      draw();

      m.querySelector('#v-guardar').onclick = function () {
        if (!cart.length) { UI.toast('Agrega al menos un servicio o producto', 'err'); return; }
        var cliente = m.querySelector('#v-cliente').value.trim() || 'Cliente';
        var fecha = m.querySelector('#v-fecha').value || UI.todayISO();
        var total = cart.reduce(function (a, c) { return a + c.unitPrice * c.qty; }, 0);
        var taxed = isTaxed();
        var d = UI.desglosar(total, taxed);

        Store.addSale({
          date: fecha,
          clientName: cliente,
          items: cart.map(function (c) { return { type: c.type, refId: c.refId, name: c.name, qty: c.qty, unitPrice: c.unitPrice }; }),
          total: d.total, base: d.base, iva: d.iva,
          taxed: taxed, method: method, invoiced: invoiced,
          userId: (Auth.current() || {}).id || null
        });
        UI.toast('Venta guardada ✔', 'ok');
        close();
        App.render();
      };
    });
  };

  /* ---------------- CATÁLOGO (servicios + productos) ---------------- */
  Negocio.renderCatalogo = function (view) {
    var services = Store.services();
    var products = Store.products();

    view.innerHTML =
      '<div class="page-head"><h1>Catálogo</h1></div>' +
      '<div class="note warn">⚠️ <div><b>Todos los precios se capturan CON IVA INCLUIDO.</b> Así nadie se equivoca mandando montos sin IVA.</div></div>' +
      '<div class="section-title">Servicios</div>' +
      '<button class="btn secondary" id="add-serv">+ Agregar nuevo servicio</button>' +
      '<div class="card" id="serv-list" style="margin-top:12px"></div>' +
      '<div class="section-title">Productos para vender</div>' +
      '<button class="btn secondary" id="add-prod">+ Agregar nuevo producto</button>' +
      '<div class="card" id="prod-list" style="margin-top:12px"></div>';

    view.querySelector('#add-serv').onclick = function () { Negocio._editServicio(null); };
    view.querySelector('#add-prod').onclick = function () { Negocio._editProducto(null); };

    var sl = view.querySelector('#serv-list');
    sl.innerHTML = services.map(function (s) {
      return '<div class="row"><div class="r-main"><div class="r-title" style="font-size:14px">' + UI.esc(s.name) + '</div>' +
        '<div class="r-sub">' + UI.money(s.price) + (s.taxed ? ' · con IVA' : ' · sin IVA') + '</div></div>' +
        '<div class="list-actions">' +
          '<button class="mini-btn" data-edit="' + s.id + '">Editar</button>' +
          '<button class="mini-btn del" data-del="' + s.id + '">Borrar</button>' +
        '</div></div>';
    }).join('') || '<div class="empty">Sin servicios.</div>';
    sl.querySelectorAll('[data-edit]').forEach(function (b) { b.onclick = function () { Negocio._editServicio(b.getAttribute('data-edit')); }; });
    sl.querySelectorAll('[data-del]').forEach(function (b) {
      b.onclick = function () { UI.confirm('¿Borrar este servicio?', function () { Store.removeService(b.getAttribute('data-del')); App.render(); }, 'Sí, borrar'); };
    });

    var pl = view.querySelector('#prod-list');
    pl.innerHTML = products.map(function (p) {
      return '<div class="row"><div class="r-main"><div class="r-title" style="font-size:14px">' + UI.esc(p.name) + '</div>' +
        '<div class="r-sub">' + UI.money(p.price) + ' · Existencias: ' + (p.stock || 0) + (p.taxed ? ' · con IVA' : ' · sin IVA') + '</div></div>' +
        '<div class="list-actions">' +
          '<button class="mini-btn" data-edit="' + p.id + '">Editar</button>' +
          '<button class="mini-btn del" data-del="' + p.id + '">Borrar</button>' +
        '</div></div>';
    }).join('') || '<div class="empty">Sin productos. Agrega los que vendes.</div>';
    pl.querySelectorAll('[data-edit]').forEach(function (b) { b.onclick = function () { Negocio._editProducto(b.getAttribute('data-edit')); }; });
    pl.querySelectorAll('[data-del]').forEach(function (b) {
      b.onclick = function () { UI.confirm('¿Borrar este producto?', function () { Store.removeProduct(b.getAttribute('data-del')); App.render(); }, 'Sí, borrar'); };
    });
  };

  Negocio._editServicio = function (id) {
    var s = id ? Store.services().find(function (x) { return x.id === id; }) : null;
    var body =
      '<div class="note warn">⚠️ Captura el precio <b>CON IVA incluido</b>.</div>' +
      '<label>Nombre del servicio</label><input id="s-name" value="' + UI.esc(s ? s.name : '') + '" />' +
      '<label>Precio (con IVA incluido)</label><input id="s-price" type="number" inputmode="decimal" min="0" step="0.01" value="' + (s ? s.price : '') + '" />' +
      '<label style="display:flex;align-items:center;gap:8px;margin-top:12px"><input type="checkbox" id="s-tax" style="width:auto" ' + (!s || s.taxed ? 'checked' : '') + '/> Este servicio causa IVA</label>' +
      '<button class="btn" id="s-save">Guardar</button>';
    UI.modal(id ? 'Editar servicio' : 'Nuevo servicio', body, function (m, close) {
      m.querySelector('#s-save').onclick = function () {
        var name = m.querySelector('#s-name').value.trim();
        if (!name) { UI.toast('Escribe el nombre', 'err'); return; }
        var data = { name: name, price: +m.querySelector('#s-price').value || 0, taxed: m.querySelector('#s-tax').checked };
        if (id) Store.updateService(id, data); else Store.addService(data);
        UI.toast('Servicio guardado ✔', 'ok'); close(); App.render();
      };
    });
  };

  Negocio._editProducto = function (id) {
    var p = id ? Store.products().find(function (x) { return x.id === id; }) : null;
    var body =
      '<div class="note warn">⚠️ Captura el precio <b>CON IVA incluido</b>.</div>' +
      '<label>Nombre del producto</label><input id="p-name" value="' + UI.esc(p ? p.name : '') + '" />' +
      '<div class="inline-2">' +
        '<div><label>Precio (con IVA)</label><input id="p-price" type="number" inputmode="decimal" min="0" step="0.01" value="' + (p ? p.price : '') + '" /></div>' +
        '<div><label>Existencias</label><input id="p-stock" type="number" inputmode="numeric" min="0" step="1" value="' + (p ? p.stock : 0) + '" /></div>' +
      '</div>' +
      '<label style="display:flex;align-items:center;gap:8px;margin-top:12px"><input type="checkbox" id="p-tax" style="width:auto" ' + (!p || p.taxed ? 'checked' : '') + '/> Este producto causa IVA</label>' +
      '<button class="btn" id="p-save">Guardar</button>';
    UI.modal(id ? 'Editar producto' : 'Nuevo producto', body, function (m, close) {
      m.querySelector('#p-save').onclick = function () {
        var name = m.querySelector('#p-name').value.trim();
        if (!name) { UI.toast('Escribe el nombre', 'err'); return; }
        var data = { name: name, price: +m.querySelector('#p-price').value || 0, stock: +m.querySelector('#p-stock').value || 0, taxed: m.querySelector('#p-tax').checked };
        if (id) Store.updateProduct(id, data); else Store.addProduct(data);
        UI.toast('Producto guardado ✔', 'ok'); close(); App.render();
      };
    });
  };

  global.Negocio = Negocio;
})(window);
