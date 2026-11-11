
/* ==========================================
   MI GALERIA - NOTIFICACIONES
   Archivo: notificaciones.js
========================================== */

(() => {
    "use strict";

    let contenedor = null;
    let temporizador = null;

    function iniciar() {
        if (contenedor) return contenedor;

        contenedor = document.createElement("div");
        contenedor.id = "notificacionesGaleria";

        Object.assign(contenedor.style, {
            position: "fixed",
            right: "20px",
            bottom: "25px",
            zIndex: "99999",
            width: "min(360px, calc(100vw - 40px))",
            pointerEvents: "none"
        });

        document.body.appendChild(contenedor);
        return contenedor;
    }

    function cerrar() {
        clearTimeout(temporizador);

        if (contenedor) {
            contenedor.replaceChildren();
        }
    }

    function mostrar(mensaje, tipo = "exito", duracion = 6500) {
        iniciar();
        cerrar();

        const colores = {
            exito: "#62d995",
            error: "#ff7777",
            info: "#80aeff",
            progreso: "#80aeff"
        };

        const iconos = {
            exito: "✓",
            error: "!",
            info: "i",
            progreso: "↻"
        };

        const tarjeta = document.createElement("div");

        Object.assign(tarjeta.style, {
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
            padding: "16px",
            background: "#242424",
            color: "#ffffff",
            border: "1px solid #444",
            borderLeft: "4px solid " +
                (colores[tipo] || colores.info),
            borderRadius: "12px",
            boxShadow: "0 12px 35px rgba(0,0,0,.5)",
            pointerEvents: "auto"
        });

        const icono = document.createElement("span");
        icono.textContent = iconos[tipo] || "i";
        icono.style.color = colores[tipo] || colores.info;
        icono.style.fontWeight = "bold";
        icono.style.fontSize = "20px";

        const texto = document.createElement("div");
        texto.textContent = String(mensaje);
        texto.style.flex = "1";
        texto.style.whiteSpace = "pre-line";
        texto.style.fontSize = "13px";
        texto.style.lineHeight = "1.6";
        texto.style.overflowWrap = "anywhere";

        const boton = document.createElement("button");
        boton.type = "button";
        boton.textContent = "×";
        boton.setAttribute("aria-label", "Cerrar notificacion");

        Object.assign(boton.style, {
            background: "transparent",
            color: "#aaa",
            border: "none",
            fontSize: "22px",
            cursor: "pointer"
        });

        boton.addEventListener("click", cerrar);

        tarjeta.append(icono, texto, boton);
        contenedor.appendChild(tarjeta);

        if (duracion > 0) {
            temporizador = setTimeout(cerrar, duracion);
        }
    }

    window.MiGaleriaNotificaciones = {
        mostrar,
        cerrar,
        exito: mensaje => mostrar(mensaje, "exito"),
        error: mensaje => mostrar(mensaje, "error", 10000),
        info: mensaje => mostrar(mensaje, "info"),
        progreso: mensaje => mostrar(mensaje, "progreso", 0)
    };
})();
