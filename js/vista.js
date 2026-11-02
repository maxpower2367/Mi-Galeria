
/* ==========================================
   MI GALERIA - CONFIGURACION DE VISTA
   Archivo: vista.js
========================================== */

function iniciarVistaGaleria() {

    const selector = document.getElementById(
        "columnasGaleria"
    );

    const galeria = document.getElementById(
        "galeria"
    );

    if (!selector || !galeria) {
        return;
    }

    /* ======================================
       OPCIONES DISPONIBLES
    ====================================== */

    const opcionesValidas = [
        "3",
        "4",
        "5",
        "6",
        "7",
        "8"
    ];

    /* ======================================
       RECUPERAR VISTA GUARDADA
    ====================================== */

    let columnasGuardadas = "4";

    try {

        const guardadas = localStorage.getItem(
            "miGaleriaColumnas"
        );

        if (opcionesValidas.includes(guardadas)) {
            columnasGuardadas = guardadas;
        }

    } catch (error) {

        console.warn(
            "No se pudo recuperar la vista guardada.",
            error
        );
    }

    /* ======================================
       APLICAR VISTA
    ====================================== */

    function aplicarVista(columnas) {

        if (!opcionesValidas.includes(columnas)) {
            columnas = "4";
        }

        selector.value = columnas;

        galeria.style.setProperty(
            "--columnas-galeria",
            columnas
        );

        /* GUARDAR PREFERENCIA */

        try {

            localStorage.setItem(
                "miGaleriaColumnas",
                columnas
            );

        } catch (error) {

            console.warn(
                "No se pudo guardar la vista.",
                error
            );
        }
    }

    /* ======================================
       CARGAR VISTA INICIAL
    ====================================== */

    aplicarVista(columnasGuardadas);

    /* ======================================
       CAMBIAR VISTA
    ====================================== */

    selector.addEventListener("change", () => {

        aplicarVista(selector.value);

    });
}

/* ==========================================
   INICIALIZAR CONFIGURACION
========================================== */

if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        iniciarVistaGaleria
    );

} else {

    iniciarVistaGaleria();
}
