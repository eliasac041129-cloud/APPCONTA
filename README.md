# CENTRO MIRE · App de Contabilidad

App web (PWA) para llevar el control de caja e IVA del negocio de cosmiatría **CENTRO MIRE**.
Funciona **sin internet** una vez instalada y **guarda los datos solo en tu dispositivo**.

## ¿Qué hace?

### 🧾 Apartado NEGOCIO (Caja)
- Registrar ventas con nombre del cliente, fecha, servicios y productos.
- Métodos de pago con desglose de IVA:
  - **Efectivo** → tú eliges si la venta es **gravada (con IVA)** o **sin IVA**.
  - **Tarjeta / Transferencia** → **siempre incluye IVA**.
- Recordatorio *"No olvides cobrar el IVA"*.
- Corte de caja del día por método de pago.

### 💠 Catálogo
- Servicios de cosmiatría precargados.
- Botones **Agregar nuevo servicio** y **Agregar nuevo producto**.
- Todos los precios se capturan **CON IVA incluido**.

### 👤 Apartado DUEÑO (protegido, solo dueño)
- **Compra de insumos y gastos** (alimentan el IVA acreditable).
- Resumen de IVA: **cobrado − acreditable = a pagar o a favor**.
- **Balance de resultados** interno del negocio.
- Mensajes de estrategia en lenguaje simple.

> El **ISR no se calcula** en la app: lo maneja el dueño aparte, como se acordó.

### ⚙️ Configuración
- Datos del negocio y tasa de IVA (editable).
- Usuarios con roles **Dueño** / **Vendedor** y contraseña.
- Respaldo: exportar / importar / borrar datos.

## Roles
- **Dueño:** ve todo (Caja, Catálogo, Dueño, Configuración).
- **Vendedor:** solo la Caja y el Catálogo.

El primer usuario que se registra queda como **Dueño**.

## Cómo instalarla en el celular
1. Abre la liga de la app (GitHub Pages) en el navegador del celular.
2. Menú del navegador → **Agregar a pantalla de inicio / Instalar app**.
3. Ábrela desde el ícono. Ya funciona sin internet.

---
⚠️ Esta app es una **herramienta de apoyo** para control de caja e IVA. No sustituye a tu contador ni el timbrado de facturas (CFDI) ante el SAT.
