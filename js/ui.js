/* ============================================================
   ui.js  ·  Utilidades compartidas: dinero, IVA, fechas, modal, toast
   ============================================================ */
(function (global) {
  'use strict';

  var UI = {
    money: function (n) {
      n = +n || 0;
      return '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },
    round2: function (n) { return Math.round((+n + Number.EPSILON) * 100) / 100; },

    // Precio SIEMPRE se captura CON IVA incluido. Desglosa total en base + IVA.
    desglosar: function (totalConIva, taxed) {
      var rate = Store.iva();
      if (!taxed || !rate) return { base: UI.round2(totalConIva), iva: 0, total: UI.round2(totalConIva) };
      var base = UI.round2(totalConIva / (1 + rate));
      var iva = UI.round2(totalConIva - base);
      return { base: base, iva: iva, total: UI.round2(totalConIva) };
    },

    todayISO: function () {
      var d = new Date();
      var off = d.getTimezoneOffset();
      return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
    },
    monthKey: function (iso) { return (iso || '').slice(0, 7); },
    currentMonth: function () { return UI.todayISO().slice(0, 7); },
    fmtDate: function (iso) {
      if (!iso) return '';
      var p = iso.slice(0, 10).split('-');
      return p[2] + '/' + p[1] + '/' + p[0];
    },
    monthName: function (mkey) {
      var names = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      var p = (mkey || UI.currentMonth()).split('-');
      return names[(+p[1]) - 1] + ' ' + p[0];
    },

    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },

    toast: function (msg, type) {
      var root = document.getElementById('toast-root');
      var el = document.createElement('div');
      el.className = 'toast ' + (type || '');
      el.textContent = msg;
      root.appendChild(el);
      setTimeout(function () {
        el.style.transition = 'opacity .3s';
        el.style.opacity = '0';
        setTimeout(function () { el.remove(); }, 300);
      }, 2200);
    },

    modal: function (title, bodyHTML, onMount) {
      var root = document.getElementById('modal-root');
      var bg = document.createElement('div');
      bg.className = 'modal-bg';
      bg.innerHTML =
        '<div class="modal">' +
          '<div class="modal-head"><h3>' + UI.esc(title) + '</h3>' +
          '<button class="modal-x" aria-label="Cerrar">&times;</button></div>' +
          '<div class="modal-body"></div>' +
        '</div>';
      bg.querySelector('.modal-body').innerHTML = bodyHTML;
      root.appendChild(bg);
      function close() { bg.remove(); }
      bg.querySelector('.modal-x').addEventListener('click', close);
      bg.addEventListener('click', function (e) { if (e.target === bg) close(); });
      if (onMount) onMount(bg.querySelector('.modal-body'), close);
      return { el: bg, close: close };
    },

    confirm: function (msg, onYes, yesLabel) {
      UI.modal('Confirmar',
        '<p style="margin:6px 0 4px">' + UI.esc(msg) + '</p>' +
        '<button class="btn danger" id="cf-yes">' + UI.esc(yesLabel || 'Sí, continuar') + '</button>' +
        '<button class="btn ghost" id="cf-no">Cancelar</button>',
        function (body, close) {
          body.querySelector('#cf-yes').onclick = function () { close(); onYes(); };
          body.querySelector('#cf-no').onclick = close;
        });
    }
  };

  global.UI = UI;
})(window);
