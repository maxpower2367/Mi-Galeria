
"use strict";

// ========================================
// MI GALERIA - CONEXION GOOGLE DRIVE
// Primera prueba: autenticacion OAuth
// ========================================

const GOOGLE_CLIENT_ID = "103011390287-u2coot9i3p4h1p0r3dd1mmm8ifaub559.apps.googleusercontent.com";

const GOOGLE_DRIVE_SCOPE =
    "https://www.googleapis.com/auth/drive.file";

let googleTokenClient = null;
let googleAccessToken = null;

function iniciarGoogleDrive() {

    const menu = document.getElementById(
        "panelMenuAjustes"
    );

    if (!menu) {
        console.error("No se encontro el menu.");
        return;
    }

    // Crear boton sin modificar los existentes
    const boton = document.createElement("button");

    boton.id = "btnConectarGoogleDrive";
    boton.type = "button";
    boton.textContent = "Conectar Google Drive";

    const estado = document.createElement("div");
    estado.id = "estadoGoogleDrive";
    estado.style.fontSize = "12px";
    estado.style.padding = "8px";
    estado.textContent = "Google Drive desconectado";

    const titulo = menu.querySelector(
        ".menu-ajustes-titulo"
    );

    if (titulo) {
        titulo.after(boton, estado);
    } else {
        menu.prepend(boton, estado);
    }

    boton.addEventListener("click", () => {

        if (!window.google?.accounts?.oauth2) {
            alert("Google aun no ha cargado.");
            return;
        }

        if (
            GOOGLE_CLIENT_ID ===
            "PEGA_AQUI_TU_ID_DE_CLIENTE"
        ) {
            alert("Debes configurar tu ID de cliente.");
            return;
        }

        if (!googleTokenClient) {

            googleTokenClient =
                google.accounts.oauth2.initTokenClient({

                    client_id: GOOGLE_CLIENT_ID,

                    scope: GOOGLE_DRIVE_SCOPE,

                    callback: respuesta => {

                        if (respuesta.error) {
                            estado.textContent =
                                "Error de autorizacion";
                            console.error(respuesta);
                            return;
                        }

                        googleAccessToken =
                            respuesta.access_token;

                        estado.textContent =
                            "Google Drive conectado";

                        boton.textContent =
                            "Reconectar Google Drive";

                        console.log(
                            "Autorizacion completada"
                        );
                    }

                });
        }

        googleTokenClient.requestAccessToken({
            prompt: googleAccessToken
                ? ""
                : "consent"
        });

    });
}

document.addEventListener(
    "DOMContentLoaded",
    iniciarGoogleDrive
);
