
/* ==========================================
   MI GALERIA - BARRA DE ESTADO
   Archivo: estado.js
========================================== */

async function actualizarBarraEstado() {

    try {

        const carpetas = await obtenerTodos("carpetas");
        const archivos = await obtenerTodos("archivos");

        /* CARPETAS DE LA UBICACION ACTUAL */

        const carpetasActuales = carpetas.filter(
            carpeta => carpeta.padre === carpetaActual
        );

        /* ARCHIVOS DE LA UBICACION ACTUAL */

        const archivosActuales = archivos.filter(
            archivo => archivo.carpeta === carpetaActual
        );

        /* CALCULAR CANTIDADES */

        const cantidadCarpetas = carpetasActuales.length;

        const cantidadArchivos = archivosActuales.length;

        const total = cantidadCarpetas + cantidadArchivos;

        /* MOSTRAR RESULTADOS */

        const contador = document.getElementById(
            "contadorElementos"
        );

        const detalle = document.getElementById(
            "detalleElementos"
        );

        if (contador) {

            contador.textContent =
                `${total} ${total === 1 ? "elemento" : "elementos"}`;
        }

        if (detalle) {

            detalle.textContent =
                `${cantidadCarpetas} ${cantidadCarpetas === 1 ? "carpeta" : "carpetas"}, ` +
                `${cantidadArchivos} ${cantidadArchivos === 1 ? "archivo" : "archivos"}`;
        }

    } catch (error) {

        console.error(
            "Error al actualizar barra de estado:",
            error
        );
    }
}
