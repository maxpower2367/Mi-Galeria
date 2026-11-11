
/* ==========================================
   MI GALERIA - CONTROL DE ACCESO
   Archivo: acceso.js
========================================== */

(function () {

    "use strict";

    /* ==========================================
       CONFIGURACION DE CONTRASENA
    ========================================== */

    // Escribe aqui tu contrasena actual.

    const CONTRASENA_GALERIA = "123456";



    /* ==========================================
   VALIDACION PARA ELIMINAR CARPETAS
========================================== */

window.MiGaleriaAcceso = Object.freeze({

    verificarContrasena(contrasena) {
        return contrasena === CONTRASENA_GALERIA;
    }

});

    /* ==========================================
       ELEMENTOS DEL FORMULARIO
    ========================================== */

    const pantallaAcceso = document.getElementById(
        "pantallaAcceso"
    );

    const campoPassword = document.getElementById(
        "accesoPassword"
    );

    const mensajeError = document.getElementById(
        "accesoError"
    );

    const formAcceso = document.getElementById(
        "formAcceso"
    );

    /* ==========================================
       VERIFICAR ELEMENTOS
    ========================================== */

    if (
        !pantallaAcceso ||
        !campoPassword ||
        !mensajeError ||
        !formAcceso
    ) {

        console.error(
            "No se encontraron los elementos del acceso."
        );

        return;
    }

    /* ==========================================
       ESTADO DE AUTORIZACION
    ========================================== */

    // La autorizacion solo se conserva
    // mientras esta pagina permanezca cargada.
    //
    // No utilizamos sessionStorage ni
    // localStorage para guardar el acceso.
    //
    // Al actualizar, el estado se reinicia.

    let accesoPermitido = false;

    /* ==========================================
       BOTON MOSTRAR Y OCULTAR CONTRASENA
    ========================================== */

    function agregarBotonVerPassword() {

        // Evitar crear botones duplicados.

        if (
            document.querySelector(
                ".boton-ver-password"
            )
        ) {
            return;
        }

        const contenedor = document.createElement("div");

        contenedor.className = "contenedor-password";

        campoPassword.parentNode.insertBefore(
            contenedor,
            campoPassword
        );

        contenedor.appendChild(campoPassword);

        const boton = document.createElement("button");

        boton.type = "button";

        boton.className = "boton-ver-password";

        boton.textContent = "👁";

        boton.title = "Mostrar contraseña";

        boton.setAttribute(
            "aria-label",
            "Mostrar contraseña"
        );

        boton.addEventListener("click", () => {

            const visible =
                campoPassword.type === "text";

            campoPassword.type = visible
                ? "password"
                : "text";

            boton.textContent = visible
                ? "👁"
                : "🙈";

            boton.title = visible
                ? "Mostrar contraseña"
                : "Ocultar contraseña";

            boton.setAttribute(
                "aria-label",
                boton.title
            );

            campoPassword.focus();
        });

        contenedor.appendChild(boton);
    }

    /* ==========================================
       REINICIAR CAMPO DE CONTRASENA
    ========================================== */

    function limpiarContrasena() {

        campoPassword.value = "";

        campoPassword.type = "password";

        mensajeError.textContent = "";

        const boton = document.querySelector(
            ".boton-ver-password"
        );

        if (boton) {

            boton.textContent = "👁";

            boton.title = "Mostrar contraseña";

            boton.setAttribute(
                "aria-label",
                "Mostrar contraseña"
            );
        }
    }

    /* ==========================================
       MOSTRAR PANTALLA DE ACCESO
    ========================================== */

    function mostrarPantallaAcceso() {

        limpiarContrasena();

        pantallaAcceso.classList.remove("oculto");

        document.body.classList.add(
            "acceso-bloqueado"
        );

        campoPassword.focus();
    }

    /* ==========================================
       OCULTAR PANTALLA DE ACCESO
    ========================================== */

    function mostrarGaleriaAutorizada() {

        pantallaAcceso.classList.add("oculto");

        document.body.classList.remove(
            "acceso-bloqueado"
        );

        limpiarContrasena();
    }

    /* ==========================================
       VERIFICAR CONTRASENA
    ========================================== */

    function verificarAcceso(evento) {

        evento.preventDefault();

        const contrasenaIngresada =
            campoPassword.value;

        if (
            contrasenaIngresada ===
            CONTRASENA_GALERIA
        ) {

            accesoPermitido = true;

            mostrarGaleriaAutorizada();

        } else {

            accesoPermitido = false;

            mensajeError.textContent =
                "Contraseña incorrecta. Intenta nuevamente.";

            campoPassword.value = "";

            campoPassword.type = "password";

            const boton = document.querySelector(
                ".boton-ver-password"
            );

            if (boton) {

                boton.textContent = "👁";

                boton.title = "Mostrar contraseña";

                boton.setAttribute(
                    "aria-label",
                    "Mostrar contraseña"
                );
            }

            campoPassword.focus();
        }
    }

    /* ==========================================
       CONTROLAR REGRESO DEL NAVEGADOR
    ========================================== */

    // Cuando se navega entre carpetas mediante
    // history.pushState y popstate, no se
    // vuelve a pedir la contrasena.
    //
    // Solo verificamos si la pagina fue
    // restaurada desde el historial del navegador.

    window.addEventListener("pageshow", evento => {

        if (evento.persisted) {

            // Si el navegador restauro la pagina
            // desde su memoria, solicitar acceso
            // nuevamente.

            accesoPermitido = false;

            mostrarPantallaAcceso();

        } else if (!accesoPermitido) {

            mostrarPantallaAcceso();
        }
    });

    /* ==========================================
       INICIAR CONTROL DE ACCESO
    ========================================== */

    function iniciarAcceso() {

        accesoPermitido = false;

        agregarBotonVerPassword();

        formAcceso.addEventListener(
            "submit",
            verificarAcceso
        );

        mostrarPantallaAcceso();
    }

    iniciarAcceso();

})();
