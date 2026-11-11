/* ==========================================
   MI GALERIA - BARRA DE ESTADO Y GOOGLE DRIVE
   Archivo: estado.js
   No modifica archivos ni ejecuta sincronizaciones.
========================================== */

let resumenSincronizacionGaleria = {
    total: 0,
    conDrive: 0,
    pendientes: 0
};

/* El resumen se muestra solamente dentro del submenu de Google Drive. */
function actualizarPanelEstadoDrive() {
    // El menu lee resumenSincronizacionGaleria al abrirse.
}

/* ==========================================
   BARRA INFERIOR ORIGINAL
========================================== */

async function actualizarBarraEstado() {
    try {
        const carpetas = await obtenerTodos("carpetas");
        const archivos = await obtenerTodos("archivos");

        const carpetasActuales = carpetas.filter(
            carpeta => carpeta.padre === carpetaActual
        );
        const archivosActuales = archivos.filter(
            archivo => archivo.carpeta === carpetaActual
        );

        const cantidadCarpetas = carpetasActuales.length;
        const cantidadArchivos = archivosActuales.length;
        const total = cantidadCarpetas + cantidadArchivos;

        const contador = document.getElementById("contadorElementos");
        const detalle = document.getElementById("detalleElementos");

        if (contador) {
            contador.textContent = `${total} ${total === 1 ? "elemento" : "elementos"}`;
        }
        if (detalle) {
            detalle.textContent =
                `${cantidadCarpetas} ${cantidadCarpetas === 1 ? "carpeta" : "carpetas"}, ` +
                `${cantidadArchivos} ${cantidadArchivos === 1 ? "archivo" : "archivos"}`;
        }

        const conDrive = archivos.filter(
            archivo => typeof archivo.driveId === "string" && archivo.driveId.trim().length > 0
        ).length;

        resumenSincronizacionGaleria = {
            total: archivos.length,
            conDrive,
            pendientes: archivos.length - conDrive
        };

        actualizarPanelEstadoDrive();
    } catch (error) {
        console.error("Error al actualizar barra de estado:", error);
    }
}
