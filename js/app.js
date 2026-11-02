
/* ==========================================
   MI GALERIA - APLICACION PRINCIPAL
   Archivo: app.js
========================================== */

function iniciarEventos() {

    /* NAVEGACION */

    $("btnInicio").addEventListener(
        "click",
        () => navegar(null)
    );

    /* BUSCADOR */

    $("buscador").addEventListener(
        "input",
        async evento => {
            busquedaActual = evento.target.value
                .trim()
                .toLowerCase();

            try {
                await mostrarContenido();
            } catch (error) {
                mostrarError(error);
            }
        }
    );

    /* ORDENAMIENTO */

    $("ordenar").addEventListener(
        "change",
        async evento => {
            ordenActual = evento.target.value;

            try {
                await mostrarContenido();
            } catch (error) {
                mostrarError(error);
            }
        }
    );

    /* MENU DE TRES PUNTOS */

    $("opSeleccionar").addEventListener(
        "click",
        seleccionarDesdeMenu
    );

    $("opRenombrar").addEventListener(
        "click",
        renombrarElemento
    );

    $("opMover").addEventListener(
        "click",
        moverElemento
    );

    $("opEliminar").addEventListener(
        "click",
        eliminarElemento
    );

    /* SELECCION MULTIPLE */

    $("btnMoverSeleccion").addEventListener(
        "click",
        moverSeleccionados
    );

    $("btnEliminarSeleccion").addEventListener(
        "click",
        eliminarSeleccionados
    );

    $("btnCancelarSeleccion").addEventListener(
        "click",
        cancelarSeleccion
    );

    /* CERRAR MENU CONTEXTUAL */

    document.addEventListener(
        "click",
        evento => {
            const menu = $("menuContextual");

            if (
                !menu.contains(evento.target) &&
                !evento.target.closest(".boton-menu")
            ) {
                cerrarMenu();
            }
        }
    );

    iniciarEventosVisor();
    iniciarEventosModales();
}

async function iniciar() {
    try {
        await iniciarDB();

        iniciarEventos();

        await mostrarContenido();

        console.log("Mi Galería iniciada correctamente.");

    } catch (error) {
        console.error(error);
        mostrarError(error);
    }
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        iniciar
    );
} else {
    iniciar();
}
