
/* ==========================================
   MI GALERIA - MENU PARA CELULARES
   Archivo: menu-movil.js
========================================== */

document.addEventListener("DOMContentLoaded", () => {

    const boton = document.getElementById(
        "btnMenuMovil"
    );

    const sidebar = document.getElementById(
        "barraLateral"
    );

    if (!boton || !sidebar) {
        return;
    }

    /* ======================================
       ABRIR O CERRAR MENU
    ====================================== */

    function cambiarEstadoMenu(abierto) {

        sidebar.classList.toggle(
            "menu-movil-abierto",
            abierto
        );

        boton.textContent = abierto ? "✕" : "☰";

        boton.setAttribute(
            "aria-expanded",
            String(abierto)
        );

        boton.setAttribute(
            "aria-label",
            abierto
                ? "Cerrar menú de carpetas"
                : "Abrir menú de carpetas"
        );
    }

    /* ======================================
       BOTON HAMBURGUESA
    ====================================== */

    boton.addEventListener("click", () => {

        const abierto = sidebar.classList.contains(
            "menu-movil-abierto"
        );

        cambiarEstadoMenu(!abierto);
    });

    /* ======================================
       CERRAR AL ELEGIR CARPETA
    ====================================== */

    sidebar.addEventListener("click", evento => {

        const opcion = evento.target.closest(
            "button, a"
        );

        if (
            opcion &&
            window.matchMedia("(max-width: 600px)").matches
        ) {
            cambiarEstadoMenu(false);
        }
    });

    /* ======================================
       CERRAR AL TOCAR FUERA
    ====================================== */

    document.addEventListener("click", evento => {

        const abierto = sidebar.classList.contains(
            "menu-movil-abierto"
        );

        if (!abierto) {
            return;
        }

        if (
            !sidebar.contains(evento.target) &&
            !boton.contains(evento.target)
        ) {
            cambiarEstadoMenu(false);
        }
    });

    /* ======================================
       CERRAR CON ESCAPE
    ====================================== */

    document.addEventListener("keydown", evento => {

        if (evento.key === "Escape") {
            cambiarEstadoMenu(false);
        }
    });

    /* ======================================
       RESTABLECER EN COMPUTADORA
    ====================================== */

    window.addEventListener("resize", () => {

        if (window.innerWidth > 600) {
            cambiarEstadoMenu(false);
        }
    });

});
