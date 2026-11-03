
/* ==========================================
   MI GALERIA - MENU HAMBURGUESA
   Archivo: menu.js
========================================== */

(() => {
    "use strict";

    const boton = document.getElementById(
        "btnMenuAjustes"
    );

    const panel = document.getElementById(
        "panelMenuAjustes"
    );

    if (!boton || !panel) return;

    function establecerMenu(abierto) {
        panel.hidden = !abierto;

        boton.setAttribute(
            "aria-expanded",
            String(abierto)
        );

        boton.textContent = abierto ? "✕" : "☰";
    }

    boton.addEventListener("click", evento => {
        evento.stopPropagation();
        establecerMenu(panel.hidden);
    });

    panel.addEventListener("click", evento => {
        if (evento.target.closest("button")) {
            establecerMenu(false);
        }
    });

    document.addEventListener("click", evento => {
        if (
            !panel.hidden &&
            !boton.contains(evento.target) &&
            !panel.contains(evento.target)
        ) {
            establecerMenu(false);
        }
    });

    document.addEventListener("keydown", evento => {
        if (evento.key === "Escape") {
            establecerMenu(false);
        }
    });
})();
