/* ============================================================
   dueno.js  ·  Apartado DUEÑO (solo rol Dueño)
   - Compra de insumos / gastos (alimentan el IVA acreditable)
   - Resumen de IVA: cobrado − acreditable = a pagar / a favor
   - Balance de resultados interno del negocio
   - GENERAR BALANCE DE RESULTADOS (documento imprimible / PDF)
   - CERRAR MES / NUEVO MES (no destructivo: conserva el historial)
   NOTA: El ISR NO se calcula aquí (lo maneja el dueño aparte).
   ============================================================ */
(function (global) {
  'use strict';

  var Dueno = {};
  var selMonth = null;

  /* ---------- Utilidades de mes ---------- */
  function nextMonth(mkey) {
    var y = +mkey.slice(0, 4), m = +mkey.slice(5, 7);
    m++; if (m > 12) { m = 1; y++; }
    return y + '-' + (m < 10 ? '0' + m : '' + m);
  }
  function prevMonth(mkey) {
    var y = +mkey.slice(0, 4), m = +mkey.slice(5, 7);
    m--; if (m < 1) { m = 12; y--; }
    return y + '-' + (m < 10 ? '0' + m : '' + m);
  }

  /* ---------- Cálculo de todas las cifras de un mes ---------- */
  Dueno._compute = function (mkey) {
    var sales = Store.sales().filter(function (s) { return UI.monthKey(s.date) === mkey; });
    var purchases = Store.purchases().filter(function (p) { return UI.monthKey(p.date) === mkey; });
    var sum = function (arr, f) { return arr.reduce(function (a, x) { return a + f(x); }, 0); };
    var R = UI.round2;

    var ventasTotal = R(sum(sales, function (s) { return s.total; }));
    var ivaCobrado = R(sum(sales, function (s) { return s.iva || 0; }));
    var baseVentas = R(sum(sales, function (s) { return s.base != null ? s.base : s.total; }));

    var efectivo = R(sum(sales, function (s) { return s.method === 'efectivo' ? s.total : 0; }));
    var tarjeta = R(sum(sales, function (s) { return s.method === 'tarjeta' ? s.total : 0; }));
    var transfer = R(sum(sales, function (s) { return s.method === 'transferencia' ? s.total : 0; }));
    var gravadas = R(sum(sales, function (s) { return s.taxed ? s.total : 0; }));
    var noGravadas = R(sum(sales, function (s) { return s.taxed ? 0 : s.total; }));

    var insumosTotal = R(sum(purchases, function (p) { return p.category === 'insumo' ? p.total : 0; }));
    var insumosBase = R(sum(purchases, function (p) { return p.category === 'insumo' ? (p.base != null ? p.base : p.total) : 0; }));
    var gastosTotal = R(sum(purchases, function (p) { return p.category === 'gasto' ? p.total : 0; }));
    var gastosBase = R(sum(purchases, function (p) { return p.category === 'gasto' ? (p.base != null ? p.base : p.total) : 0; }));
    var ivaAcreditable = R(sum(purchases, function (p) { return p.iva || 0; }));

    var costoTotal = R(insumosTotal + gastosTotal);
    var costoNeto = R(insumosBase + gastosBase);
    var utilidadNeta = R(baseVentas - costoNeto);
    var utilidadFlujo = R(ventasTotal - costoTotal);
    var ivaResultado = R(ivaCobrado - ivaAcreditable);

    var nVentas = sales.length;
    var ticket = nVentas ? R(ventasTotal / nVentas) : 0;

    var counts = {};
    sales.forEach(function (s) { (s.items || []).forEach(function (it) { counts[it.name] = (counts[it.name] || 0) + it.qty; }); });
    var topName = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
    var topServicio = topName ? topName + ' (' + counts[topName] + ')' : '—';

    return {
      mkey: mkey, nVentas: nVentas, ventasTotal: ventasTotal, ivaCobrado: ivaCobrado, baseVentas: baseVentas,
      efectivo: efectivo, tarjeta: tarjeta, transfer: transfer, gravadas: gravadas, noGravadas: noGravadas,
      insumosTotal: insumosTotal, insumosBase: insumosBase, gastosTotal: gastosTotal, gastosBase: gastosBase,
      ivaAcreditable: ivaAcreditable, costoTotal: costoTotal, costoNeto: costoNeto,
      utilidadNeta: utilidadNeta, utilidadFlujo: utilidadFlujo, ivaResultado: ivaResultado,
      ticket: ticket, topServicio: topServicio
    };
  };

  // Saldo de IVA a favor arrastrado del mes anterior (si ese mes se cerró con saldo a favor)
  Dueno._favorAnterior = function (mkey) {
    var c = Store.getClosure(prevMonth(mkey));
    if (c && c.snapshot && c.snapshot.ivaResultado < 0) return Math.abs(c.snapshot.ivaResultado);
    return 0;
  };

  /* ---------------- Render principal ---------------- */
  Dueno.render = function (view) {
    if (!selMonth) selMonth = UI.currentMonth();
    var mkey = selMonth;
    var f = Dueno._compute(mkey);
    var closed = Store.getClosure(mkey);
    var favorAnt = Dueno._favorAnterior(mkey);

    var purchases = Store.purchases().filter(function (p) { return UI.monthKey(p.date) === mkey; });

    var months = {};
    Store.sales().forEach(function (s) { months[UI.monthKey(s.date)] = 1; });
    Store.purchases().forEach(function (p) { months[UI.monthKey(p.date)] = 1; });
    Store.closures().forEach(function (c) { months[c.month] = 1; });
    months[UI.currentMonth()] = 1;
    months[selMonth] = 1;
    var monthList = Object.keys(months).sort().reverse();

    view.innerHTML =
      '<div class="page-head"><h1>Dueño</h1></div>' +
      '<label>Periodo</label>' +
      '<select id="d-month">' + monthList.map(function (mk) {
        var isC = Store.getClosure(mk) ? ' · cerrado' : '';
        return '<option value="' + mk + '"' + (mk === mkey ? ' selected' : '') + '>' + UI.monthName(mk) + isC + '</option>';
      }).join('') + '</select>' +

      (closed ? '<div class="note ok" style="margin-top:8px">🔒 <div>Mes <b>cerrado</b> el ' + UI.fmtDate(closed.closedAt) + '. El historial se conserva; puedes volver a generar su balance.</div></div>' : '') +
      (favorAnt > 0 ? '<div class="note info" style="margin-top:8px">↩️ <div>Del mes anterior traes <b>' + UI.money(favorAnt) + ' de IVA a favor</b> que puedes acreditar ante el SAT.</div></div>' : '') +

      '<div class="section-title">Estrategia · IVA de ' + UI.monthName(mkey) + '</div>' +
      Dueno._ivaMessage(f.ivaCobrado, f.ivaAcreditable, f.ivaResultado) +

      '<div class="stat-grid" style="margin-top:6px">' +
        '<div class="stat p"><div class="lbl">IVA que cobraste</div><div class="val">' + UI.money(f.ivaCobrado) + '</div></div>' +
        '<div class="stat g"><div class="lbl">IVA acreditable (insumos)</div><div class="val">' + UI.money(f.ivaAcreditable) + '</div></div>' +
        '<div class="stat ' + (f.ivaResultado >= 0 ? 'r' : 'b') + ' full">' +
          '<div class="lbl">' + (f.ivaResultado >= 0 ? 'IVA a PAGAR al SAT' : 'IVA a FAVOR (saldo)') + '</div>' +
          '<div class="val">' + UI.money(Math.abs(f.ivaResultado)) + '</div></div>' +
      '</div>' +

      '<div class="section-title">Balance de resultados (negocio)</div>' +
      '<div class="card">' +
        '<div class="total-line"><span>Ingresos netos (ventas sin IVA)</span><b>' + UI.money(f.baseVentas) + '</b></div>' +
        '<div class="total-line"><span>− Insumos y gastos (sin IVA)</span><b>' + UI.money(f.costoNeto) + '</b></div>' +
        '<div class="total-line grand"><span>Utilidad del negocio</span><b style="color:' + (f.utilidadNeta >= 0 ? 'var(--green)' : 'var(--red)') + '">' + UI.money(f.utilidadNeta) + '</b></div>' +
      '</div>' +

      '<button class="btn" id="btn-balance">📄 Generar balance de resultados</button>' +
      '<button class="btn secondary" id="btn-cerrar">📅 Cerrar mes / Iniciar nuevo mes</button>' +
      '<div class="note info" style="margin-top:8px">💡 <div>Cerrar el mes <b>no borra nada</b>: guarda el reporte y te lleva al mes siguiente en ceros. Tus insumos, productos e historial se conservan.</div></div>' +

      '<div class="section-title">Compra de insumos y gastos</div>' +
      '<button class="btn secondary" id="add-insumo">+ Agregar insumo / gasto</button>' +
      '<div class="note warn" style="margin-top:10px">⚠️ <div><b>Captura el monto CON IVA incluido</b> (tal como viene en el ticket o factura de tu proveedor).</div></div>' +
      '<div class="card" id="ins-list" style="margin-top:6px"></div>' +

      (Store.closures().length ? '<div class="section-title">Meses cerrados</div><div class="card" id="clo-list"></div>' : '');

    view.querySelector('#d-month').onchange = function (e) { selMonth = e.target.value; App.render(); };
    view.querySelector('#add-insumo').onclick = function () { Dueno._editInsumo(); };
    view.querySelector('#btn-balance').onclick = function () { Dueno._generarBalance(mkey); };
    view.querySelector('#btn-cerrar').onclick = function () { Dueno._cerrarMes(mkey); };

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

    var clo = view.querySelector('#clo-list');
    if (clo) {
      clo.innerHTML = Store.closures().map(function (c) {
        return '<div class="row"><div class="r-main">' +
          '<div class="r-title" style="font-size:14px">' + UI.monthName(c.month) + '</div>' +
          '<div class="r-sub">Cerrado ' + UI.fmtDate(c.closedAt) + ' · Utilidad ' + UI.money(c.snapshot.utilidadNeta) + '</div></div>' +
          '<button class="mini-btn" data-bal="' + c.month + '">📄 Ver balance</button>' +
        '</div>';
      }).join('');
      clo.querySelectorAll('[data-bal]').forEach(function (b) {
        b.onclick = function () { Dueno._generarBalance(b.getAttribute('data-bal')); };
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

  /* ---------------- Documento: Estado de Resultados ---------------- */
  Dueno._balanceDocHTML = function (mkey) {
    var f = Dueno._compute(mkey);
    var cfg = Store.getConfig();
    var favorAnt = Dueno._favorAnterior(mkey);
    var ivaNetoConFavor = UI.round2(f.ivaResultado - favorAnt);

    function row(l, v, cls) {
      return '<tr class="' + (cls || '') + '"><td>' + l + '</td><td class="num">' + UI.money(v) + '</td></tr>';
    }
    function sub(title) { return '<tr class="sec"><td colspan="2">' + title + '</td></tr>'; }

    var ivaLine = f.ivaResultado >= 0
      ? row('IVA a pagar al SAT', f.ivaResultado, 'tot')
      : row('IVA a favor (saldo)', Math.abs(f.ivaResultado), 'tot');

    return '' +
      '<div class="bal-header">' +
        '<div class="bal-logo">CM</div>' +
        '<div><div class="bal-biz">' + UI.esc(cfg.businessName) + '</div>' +
        '<div class="bal-sub">Estado de Resultados · Régimen RESICO</div></div>' +
      '</div>' +
      '<div class="bal-meta">' +
        '<span><b>Periodo:</b> ' + UI.monthName(mkey) + '</span>' +
        '<span><b>Generado:</b> ' + UI.fmtDate(UI.todayISO()) + '</span>' +
      '</div>' +

      '<table class="bal-table">' +
        sub('1. INGRESOS') +
        row('Ventas cobradas (con IVA)', f.ventasTotal) +
        row('(−) IVA cobrado', f.ivaCobrado) +
        row('= Ingresos netos (sin IVA)', f.baseVentas, 'tot') +

        sub('2. COSTOS Y GASTOS') +
        row('Insumos (con IVA)', f.insumosTotal) +
        row('Otros gastos (con IVA)', f.gastosTotal) +
        row('(−) IVA acreditable', f.ivaAcreditable) +
        row('= Costos y gastos netos', f.costoNeto, 'tot') +

        sub('3. RESULTADO') +
        row('Ingresos netos', f.baseVentas) +
        row('(−) Costos y gastos netos', f.costoNeto) +
        row('= UTILIDAD DEL PERIODO', f.utilidadNeta, 'grand') +

        sub('4. SITUACIÓN DE IVA (fiscal)') +
        row('IVA cobrado', f.ivaCobrado) +
        row('IVA acreditable', f.ivaAcreditable) +
        (favorAnt > 0 ? row('(−) IVA a favor mes anterior', favorAnt) : '') +
        ivaLine +

        sub('5. CÓMO ENTRÓ EL DINERO (flujo)') +
        row('Efectivo', f.efectivo) +
        row('Tarjeta', f.tarjeta) +
        row('Transferencia', f.transfer) +
        row('Ventas gravadas (con IVA)', f.gravadas) +
        row('Ventas no gravadas (sin IVA)', f.noGravadas) +
        row('Total cobrado', f.ventasTotal, 'tot') +
      '</table>' +

      '<div class="bal-ind">' +
        '<div><span>Número de ventas</span><b>' + f.nVentas + '</b></div>' +
        '<div><span>Ticket promedio</span><b>' + UI.money(f.ticket) + '</b></div>' +
        '<div><span>Servicio más vendido</span><b>' + UI.esc(f.topServicio) + '</b></div>' +
      '</div>' +

      '<p class="bal-foot">Documento generado por la app de contabilidad de ' + UI.esc(cfg.businessName) + '. ' +
      'Es una herramienta de apoyo y no sustituye a tu contador ni a los cálculos oficiales del SAT.</p>';
  };

  Dueno._generarBalance = function (mkey) {
    var prev = document.getElementById('balance-overlay');
    if (prev) prev.remove();

    var ov = document.createElement('div');
    ov.id = 'balance-overlay';
    ov.className = 'balance-overlay';
    ov.innerHTML =
      '<div class="balance-actions">' +
        '<button class="mini-btn" id="bal-close">← Cerrar</button>' +
        '<button class="btn small green" id="bal-print">🖨️ Imprimir / Guardar PDF</button>' +
      '</div>' +
      '<div class="balance-doc" id="balance-doc">' + Dueno._balanceDocHTML(mkey) + '</div>';
    document.body.appendChild(ov);

    ov.querySelector('#bal-close').onclick = function () { ov.remove(); };
    ov.querySelector('#bal-print').onclick = function () {
      try { window.print(); } catch (e) { UI.toast('Usa el menú del navegador para imprimir', 'err'); }
    };
  };

  /* ---------------- Cerrar mes (NO destructivo) ---------------- */
  Dueno._cerrarMes = function (mkey) {
    var sig = nextMonth(mkey);
    UI.confirm(
      'Vas a cerrar ' + UI.monthName(mkey) + '. Se guardará su balance y pasarás a ' + UI.monthName(sig) +
      ' (que empieza en ceros). Tu historial, insumos y productos NO se borran. ¿Continuar?',
      function () {
        var f = Dueno._compute(mkey);
        Store.addClosure({ month: mkey, closedAt: new Date().toISOString(), snapshot: f });
        selMonth = sig;
        UI.toast('Mes cerrado. Empiezas ' + UI.monthName(sig) + ' en ceros ✔', 'ok');
        Dueno._generarBalance(mkey);
        App.render();
      },
      'Sí, cerrar mes'
    );
  };

  /* ---------------- Insumos ---------------- */
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
