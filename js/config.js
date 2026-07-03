/* ============================================================
   config.js  ·  Configuración (solo rol Dueño)
   - Datos del negocio y tasa de IVA
   - Alta de usuarios (vendedores) y cambio de contraseña
   - Respaldo: exportar / importar datos, reiniciar
   ============================================================ */
(function (global) {
  'use strict';

  var Config = {};

  Config.render = function (view) {
    var cfg = Store.getConfig();
    var me = Auth.current();

    view.innerHTML =
      '<div class="page-head"><h1>Configuración</h1></div>' +

      '<div class="card">' +
        '<h3>Datos del negocio</h3>' +
        '<label>Nombre del negocio</label><input id="c-name" value="' + UI.esc(cfg.businessName) + '" />' +
        '<label>Tasa de IVA (%)</label><input id="c-iva" type="number" inputmode="decimal" min="0" max="100" step="0.5" value="' + (cfg.ivaRate * 100) + '" />' +
        '<div class="field-hint">En México el IVA general es 16%. Editable por si tu contador lo indica.</div>' +
        '<button class="btn" id="c-save">Guardar cambios</button>' +
      '</div>' +

      '<div class="card">' +
        '<h3>Usuarios</h3>' +
        '<div id="c-users"></div>' +
        '<button class="btn secondary" id="c-adduser">+ Agregar vendedor</button>' +
      '</div>' +

      '<div class="card">' +
        '<h3>Mi contraseña</h3>' +
        '<button class="btn secondary" id="c-mypass">Cambiar mi contraseña</button>' +
      '</div>' +

      '<div class="card">' +
        '<h3>Respaldo de datos</h3>' +
        '<div class="note info">💡 <div>Tus datos viven solo en este dispositivo. Haz respaldos de vez en cuando y guárdalos en un lugar seguro.</div></div>' +
        '<button class="btn secondary" id="c-export">⬇️ Descargar respaldo</button>' +
        '<button class="btn secondary" id="c-import">⬆️ Restaurar respaldo</button>' +
        '<input type="file" id="c-file" accept="application/json" class="hidden" />' +
        '<button class="btn danger" id="c-reset">🗑️ Borrar todos los datos</button>' +
      '</div>' +

      '<div class="note warn">⚠️ <div>Esta app es una <b>herramienta de apoyo</b> para tu control de caja e IVA. No sustituye a tu contador ni el timbrado de facturas ante el SAT.</div></div>';

    view.querySelector('#c-save').onclick = function () {
      var name = view.querySelector('#c-name').value.trim() || 'CENTRO MIRE';
      var iva = (+view.querySelector('#c-iva').value || 0) / 100;
      Store.setConfig({ businessName: name, ivaRate: iva });
      UI.toast('Configuración guardada ✔', 'ok');
      App.render();
    };

    var ubox = view.querySelector('#c-users');
    ubox.innerHTML = Store.users().map(function (u) {
      var isMe = me && u.id === me.id;
      return '<div class="row"><div class="r-main">' +
        '<div class="r-title" style="font-size:14px">' + UI.esc(u.name) + (isMe ? ' (tú)' : '') + '</div>' +
        '<div class="r-sub">@' + UI.esc(u.username) + ' · ' + (u.role === 'dueno' ? 'Dueño' : 'Vendedor') + '</div>' +
      '</div>' +
      (isMe ? '' : '<button class="mini-btn del" data-deluser="' + u.id + '">Quitar</button>') +
      '</div>';
    }).join('');
    ubox.querySelectorAll('[data-deluser]').forEach(function (b) {
      b.onclick = function () {
        UI.confirm('¿Quitar este usuario?', function () { Store.removeUser(b.getAttribute('data-deluser')); UI.toast('Usuario quitado'); App.render(); }, 'Sí, quitar');
      };
    });

    view.querySelector('#c-adduser').onclick = Config._addUser;
    view.querySelector('#c-mypass').onclick = function () { Config._changePass(me.id); };

    view.querySelector('#c-export').onclick = function () {
      var blob = new Blob([Store.exportJSON()], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'centromire-respaldo-' + UI.todayISO() + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
      UI.toast('Respaldo descargado ✔', 'ok');
    };
    var fileEl = view.querySelector('#c-file');
    view.querySelector('#c-import').onclick = function () { fileEl.click(); };
    fileEl.onchange = function (e) {
      var f = e.target.files[0]; if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        UI.confirm('Esto reemplazará TODOS los datos actuales por los del respaldo. ¿Continuar?', function () {
          try { Store.importJSON(reader.result); UI.toast('Respaldo restaurado ✔', 'ok'); App.render(); }
          catch (err) { UI.toast('Archivo inválido', 'err'); }
        }, 'Sí, restaurar');
      };
      reader.readAsText(f);
    };

    view.querySelector('#c-reset').onclick = function () {
      UI.confirm('¿BORRAR TODO? Se eliminan ventas, insumos, usuarios y configuración. Esto no se puede deshacer.', function () {
        Store.resetAll();
        Auth.logout();
        UI.toast('Datos borrados');
        location.reload();
      }, 'Sí, borrar todo');
    };
  };

  Config._addUser = function () {
    var body =
      '<label>Nombre</label><input id="u-name" placeholder="Nombre del vendedor" />' +
      '<label>Usuario (para iniciar sesión)</label><input id="u-user" autocomplete="off" placeholder="ej. recepcion" />' +
      '<label>Contraseña</label><input id="u-pass" type="password" placeholder="mínimo 4 caracteres" />' +
      '<label>Rol</label><select id="u-role"><option value="vendedor">Vendedor (solo caja)</option><option value="dueno">Dueño (acceso total)</option></select>' +
      '<button class="btn" id="u-save">Crear usuario</button>';
    UI.modal('Agregar usuario', body, function (m, close) {
      m.querySelector('#u-save').onclick = function () {
        try {
          Auth.register(
            m.querySelector('#u-name').value,
            m.querySelector('#u-user').value,
            m.querySelector('#u-pass').value,
            m.querySelector('#u-role').value
          );
          UI.toast('Usuario creado ✔', 'ok'); close(); App.render();
        } catch (e) { UI.toast(e.message, 'err'); }
      };
    });
  };

  Config._changePass = function (userId) {
    var body =
      '<label>Nueva contraseña</label><input id="np" type="password" placeholder="mínimo 4 caracteres" />' +
      '<label>Repite la contraseña</label><input id="np2" type="password" />' +
      '<button class="btn" id="np-save">Cambiar contraseña</button>';
    UI.modal('Cambiar contraseña', body, function (m, close) {
      m.querySelector('#np-save').onclick = function () {
        var a = m.querySelector('#np').value, b = m.querySelector('#np2').value;
        if (a !== b) { UI.toast('Las contraseñas no coinciden', 'err'); return; }
        try { Auth.changePassword(userId, a); UI.toast('Contraseña actualizada ✔', 'ok'); close(); }
        catch (e) { UI.toast(e.message, 'err'); }
      };
    });
  };

  global.Config = Config;
})(window);
