/* ============================================================
   dueno.js  ·  Apartado DUEÑO (solo rol Dueño)
   - Compra de insumos / gastos (alimentan el IVA acreditable)
   - Resumen de IVA: cobrado − acreditable = a pagar / a favor
   - Balance de resultados interno del negocio
   - Mensajes de estrategia en lenguaje simple
   NOTA: El ISR NO se calcula aquí (lo maneja el dueño aparte).
   ============================================================ */
(function (global) {
  'use strict';

  var Dueno = {};
  var selMonth = null;

  Dueno.render = function (view) {
    if (!selMonth) selMonth = UI.currentMonth();
    var mkey = selMonth;

    var sales = Store.sales().filter(function (s) { return UI.monthKey(s.date) === mkey; });
    var purchases = Store.purchases().filter(function (p) { return UI.monthKey(p.date) === mkey; });
    var sum = function (arr, f) { return arr.reduce(function (a, x) { return a + f(x); }, 0); };

    var ivaCobrado = UI.round2(sum(sales, function (s) { return s.iva || 0; }));
    var ivaAcreditable = UI.round2(sum(purchases, function (p) { return p.iva || 0; }));
    var ivaResultado = UI.round2(ivaCobrado - ivaAcreditable);

    var ingresos = UI.round2(sum(sales, function (s) { return s.total; }));
    var costoInsumos = UI.round2(sum(purchases, function (p) { return p.category === 'insumo' ? p.total : 0; }));
    var gastos = UI.round2(sum(purchases, function (p) { return p.category === 'gasto' ? p.total : 0; }));
    var utilidad = UI.round2(ingresos - costoInsumos - gastos);

    var months = {};
    Store.sales().forEach(function (s) { months[UI.monthKey(s.date)] = 1; });
    Store.purchases().forEach(function (p) { months[UI.monthKey(p.date)] = 1; });
    months[UI.currentMonth()] = 1;
    var monthList = Object.keys(months).sort().reverse();

    view.innerHTML =
      '<div class="page-head"><h1>Dueño</h1></div>' +
      '<label>Periodo</label>' +
      '<select id="d-month">' + monthList.map(function (mk) {
        return '<option value="' + mk + '"' + (mk === mkey ? ' selected' : '') + '>' + UI.monthName(mk) + '</option>';
      }).join('') + '</select>' +

      '<div class="section-title">Estrategia · IVA de ' + UI.monthName(mkey) + '</div>' +
      Dueno._ivaMessage(ivaCobrado, ivaAcreditable, ivaResultado) +

      '<div class="stat-grid" style="margin-top:6px">' +
        '<div class="stat p"><div class="lbl">IVA que cobraste</div><div class="val">' + UI.money(ivaCobrado) + '</div></div>' +
        '<div class="stat g"><div class="lbl">IVA acreditable (insumos)</div><div class="val">' + UI.money(ivaAcreditable) + '</div></div>' +
        '<div class="stat ' + (ivaResultado >= 0 ? 'r' : 'b') + ' full">' +
          '<div class="lbl">' + (ivaResultado >= 0 ? 'IVA a PAGAR al SAT' : 'IVA a FAVOR (saldo)') + '</div>' +
          '<div class="val">' + UI.money(Math.abs(ivaResultado)) + '</div></div>' +
      '</div>' +

      '<div class="section-title">Balance de resultados (negocio)</div>' +
      '<div class="card">' +
        '<div class="total-line"><span>Ingresos (ventas)</span><b>' + UI.money(ingresos) + '</b></div>' +
        '<div class="total-line"><span>− Insumos</span><b>' + UI.money(costoInsumos) + '</b></div>' +
        '<div class="total-line"><span>− Otros gastos</span><b>' + UI.money(gastos) + '</b></div>' +
        '<div class="total-line grand"><span>Utilidad del negocio</span><b style="color:' + (utilidad >= 0 ? 'var(--green)' : 'var(--red)') + '">' + UI.money(utilidad) + '</b></div>' +
      '</div>' +
      '<div class="note info">💡 <div>Esta utilidad es para saber si tu negocio es rentable. <b>No es la base del ISR</b>; en RESICO el ISR se calcula sobre lo que cobras, y lo manejas tú aparte.</div></div>' +

      '<div class="section-title">Compra de insumos y gastos</div>' +
      '<button class="btn secondary" id="add-insumo">+ Agregar insumo / gasto</button>' +
      '<div class="note warn" style="margin-top:10px">⚠️ <div><b>Captura el monto CON IVA incluido</b> (tal como viene en el ticket o factura de tu proveedor).</div></div>' +
      '<div class="card" id="ins-list" style="margin-top:6px"></div>';

    view.querySelector('#d-month').onchange = function (e) { selMonth = e.target.value; App.render(); };
    view.querySelector('#add-insumo').onclick = function () { Dueno._editInsumo(); };

    var box = view.querySelector('#ins-list');
    if (!purchases.length) {
      box.innerHTML = '<div class="empty"><div class="big">🧴</div>Sin insumos ni gastos este mes.</div>';
    } else {
      box.innerHTML = purchases.map(function (p) {
        return '<div class="row"><div class="r-main">' +
          '<div class="r-title" style="font-size:14px">' + UI.esc(p.concept) + '</div>' +
          '<div class="r-sub">' + UI.fmtDate(p.date) + (p.provider ? ' · ' + UI.esc(p.provider) : '') +
            ' · <span class="pill ' + (p.category === 'insumo' ? 'transferencia' : 'iva') + '">' + (p.category === 'insumo' ? 'Insumo' : 'Gasto') + '</span></div>' +
          '<div class="r-sub">IVA acreditable: ' + UI.money(p.iva || 0) + '</div>' +
        '</div>' +
        '<div class="r-amt">' + UI.money(p.total) +
          '<button class="mini-btn del" data-del="' + p.id + '" style="margin-top:6px;display:block">Borrar</button>' +
        '</div></div>';
      }).join('');
      box.querySelectorAll('[data-del]').forEach(function (b) {
        b.onclick = function () {
          UI.confirm('¿Borrar este registro?', function () { Store.removePurchase(b.getAttribute('data-del')); UI.toast('Borrado'); App.render(); }, 'Sí, borrar');
        };
      });
    }
  };

  Dueno._ivaMessage = function (cobrado, acreditable, resultado) {
    if (cobrado === 0 && acreditable === 0) {
      return '<div class="note info">💡 <div>Todavía no hay movimientos con IVA este mes.</div></div>';
    }
    if (resultado > 0) {
      return '<div class="note err">📌 <div>Este mes <b>debes pagar ' + UI.money(resultado) + ' de IVA</b> al SAT. ' +
        'Cobraste ' + UI.money(cobrado) + ' y puedes acreditar ' + UI.money(acreditable) + ' de tus insumos. ' +
        'Se paga a más tardar el <b>día 17</b> del siguiente mes.</div></div>';
    }
    if (resultado < 0) {
      return '<div class="note ok">✅ <div>Tienes <b>' + UI.money(Math.abs(resultado)) + ' de IVA a favor</b>. ' +
        'Acreditaste más IVA (' + UI.money(acreditable) + ') del que cobraste (' + UI.money(cobrado) + '). ' +
        'Ese saldo lo puedes aplicar en meses siguientes.</div></div>';
    }
    return '<div class="note ok">✅ <div>Tu IVA cobrado y acreditable se emparejan: este mes no pagas IVA.</div></div>';
  };

  Dueno._editInsumo = function () {
    var body =
      '<div class="note warn">⚠️ Captura el monto <b>CON IVA incluido</b> (como viene en tu ticket/factura).</div>' +
      '<label>¿Qué es?</label>' +
      '<div class="seg" id="i-cat">' +
        '<button data-c="insumo" class="on">🧴 Insumo</button>' +
        '<button data-c="gasto">🧾 Otro gasto</button>' +
      '</div>' +
      '<label>Concepto</label><input id="i-concept" placeholder="Ej. Ácido hialurónico, renta, luz..." />' +
      '<label>Proveedor (opcional)</label><input id="i-prov" placeholder="Ej. Distribuidora XYZ" />' +
      '<label>Fecha</label><input id="i-fecha" type="date" value="' + UI.todayISO() + '" />' +
      '<label>Monto total (con IVA)</label><input id="i-monto" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00" />' +
      '<label style="display:flex;align-items:center;gap:8px;margin-top:12px"><input type="checkbox" id="i-tax" style="width:auto" checked/> Esta compra tiene IVA acreditable</label>' +
      '<div class="card" id="i-prev" style="margin-top:12px;background:var(--primary-light)"></div>' +
      '<button class="btn" id="i-save">Guardar</button>';

    UI.modal('Agregar insumo / gasto', body, function (m, close) {
      var cat = 'insumo';
      m.querySelectorAll('#i-cat button').forEach(function (b) {
        b.onclick = function () {
          m.querySelectorAll('#i-cat button').forEach(function (x) { x.classList.remove('on'); });
          b.classList.add('on'); cat = b.getAttribute('data-c');
        };
      });
      var montoEl = m.querySelector('#i-monto');
      var taxEl = m.querySelector('#i-tax');
      var prev = m.querySelector('#i-prev');
      function draw() {
        var d = UI.desglosar(+montoEl.value || 0, taxEl.checked);
        prev.innerHTML =
          '<div class="total-line"><span>Base</span><b>' + UI.money(d.base) + '</b></div>' +
          '<div class="total-line"><span>IVA acreditable</span><b>' + UI.money(d.iva) + '</b></div>' +
          '<div class="total-line grand"><span>Total</span><b>' + UI.money(d.total) + '</b></div>';
      }
      montoEl.oninput = draw; taxEl.onchange = draw; draw();

      m.querySelector('#i-save').onclick = function () {
        var concept = m.querySelector('#i-concept').value.trim();
        if (!concept) { UI.toast('Escribe el concepto', 'err'); return; }
        var monto = +montoEl.value || 0;
        if (monto <= 0) { UI.toast('Escribe un monto válido', 'err'); return; }
        var d = UI.desglosar(monto, taxEl.checked);
        Store.addPurchase({
          date: m.querySelector('#i-fecha').value || UI.todayISO(),
          concept: concept,
          provider: m.querySelector('#i-prov').value.trim(),
          category: cat,
          total: d.total, base: d.base, iva: d.iva, taxed: taxEl.checked
        });
        UI.toast('Guardado ✔', 'ok'); close(); App.render();
      };
    });
  };

  global.Dueno = Dueno;
})(window);
