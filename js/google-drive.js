
"use strict";

// ========================================
// MI GALERIA - GOOGLE DRIVE
// Conexion y prueba de subida
// ========================================

const GOOGLE_CLIENT_ID =
    "103011390287-u2coot9i3p4h1p0r3dd1mmm8ifaub559.apps.googleusercontent.com";

const GOOGLE_DRIVE_SCOPE =
    "https://www.googleapis.com/auth/drive.file";

let googleTokenClient = null;
let googleAccessToken = null;

// ========================================
// INICIAR GOOGLE DRIVE
// ========================================

function iniciarGoogleDrive() {

    const menu = document.getElementById(
        "panelMenuAjustes"
    );

    if (!menu) {
        console.error("No se encontro el menu.");
        return;
    }

    const boton = document.createElement("button");
    boton.id = "btnConectarGoogleDrive";
    boton.type = "button";
    boton.textContent = "Conectar Google Drive";

    const estado = document.createElement("div");
    estado.id = "estadoGoogleDrive";
    estado.style.fontSize = "12px";
    estado.style.padding = "8px";
    estado.textContent = "Google Drive desconectado";

    const botonPrueba = document.createElement("button");
    botonPrueba.id = "btnPruebaGoogleDrive";
    botonPrueba.type = "button";
    botonPrueba.textContent = "Subir prueba a Google Drive";
    botonPrueba.disabled = true;

    const selector = document.createElement("input");
    selector.type = "file";
    selector.accept = "image/*,video/*";
    selector.style.display = "none";

    const titulo = menu.querySelector(
        ".menu-ajustes-titulo"
    );

    if (titulo) {
        titulo.after(boton, estado, botonPrueba, selector);
    } else {
        menu.prepend(boton, estado, botonPrueba, selector);
    }

    boton.addEventListener("click", () => {

        if (!window.google?.accounts?.oauth2) {
            alert("Google aun no ha cargado.");
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

                        botonPrueba.disabled = false;
                    }

                });
        }

        googleTokenClient.requestAccessToken({
            prompt: googleAccessToken ? "" : "consent"
        });
    });

    botonPrueba.addEventListener("click", () => {
        selector.click();
    });

    selector.addEventListener("change", async () => {

        const archivo = selector.files[0];

        if (!archivo) return;

        botonPrueba.disabled = true;
        estado.textContent = "Subiendo archivo...";

        try {

            const resultado =
                await subirArchivoGoogleDrive(archivo);

            estado.textContent =
                "Archivo subido correctamente";

            console.log(
                "Archivo guardado en Google Drive:",
                resultado
            );

            alert(
                "Archivo subido a Google Drive.\n\n" +
                "Nombre: " + resultado.name + "\n" +
                "ID: " + resultado.id
            );

        } catch (error) {

            console.error(error);

            estado.textContent =
                "Error al subir archivo";

            alert(
                "No se pudo subir el archivo:\n" +
                error.message
            );

        } finally {

            selector.value = "";
            botonPrueba.disabled = false;
        }
    });
}

// ========================================
// SUBIR ARCHIVO A GOOGLE DRIVE
// ========================================

async function subirArchivoGoogleDrive(archivo) {

    if (!googleAccessToken) {
        throw new Error(
            "Primero debes conectar Google Drive."
        );
    }

    const metadata = {
        name: archivo.name,
        mimeType: archivo.type ||
            "application/octet-stream"
    };

    const separador =
        "mi_galeria_" + Date.now();

    const encabezado =
        "--" + separador + "\r\n" +
        "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
        JSON.stringify(metadata) + "\r\n" +
        "--" + separador + "\r\n" +
        "Content-Type: " +
        metadata.mimeType + "\r\n\r\n";

    const cierre =
        "\r\n--" + separador + "--";

    const cuerpo = new Blob([
        encabezado,
        archivo,
        cierre
    ]);

    const respuesta = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files" +
        "?uploadType=multipart&fields=id,name,mimeType",

        {
            method: "POST",

            headers: {
                Authorization:
                    "Bearer " + googleAccessToken,

                "Content-Type":
                    "multipart/related; boundary=" +
                    separador
            },

            body: cuerpo
        }
    );

    const resultado = await respuesta.json();

    if (!respuesta.ok) {
        throw new Error(
            resultado.error?.message ||
            "Error desconocido de Google Drive."
        );
    }

    return resultado;
}

document.addEventListener(
    "DOMContentLoaded",
    iniciarGoogleDrive
);
