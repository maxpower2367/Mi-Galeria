
"use strict";

// ==========================================
// MI GALERIA - GOOGLE DRIVE
// Conexion OAuth y subida de archivos
// ==========================================

const GOOGLE_CLIENT_ID =
    "103011390287-u2coot9i3p4h1p0r3dd1mmm8ifaub559.apps.googleusercontent.com";

const GOOGLE_DRIVE_SCOPE =
    "https://www.googleapis.com/auth/drive.file";

let googleTokenClient = null;
let googleAccessToken = null;
let googleTokenExpira = 0;

function googleDriveDisponible() {
    return Boolean(
        googleAccessToken &&
        Date.now() < googleTokenExpira
    );
}

function actualizarEstadoGoogleDrive(mensaje) {
    const estado = document.getElementById(
        "estadoGoogleDrive"
    );

    if (estado) {
        estado.textContent = mensaje;
    }

    const botonPrueba = document.getElementById(
        "btnPruebaGoogleDrive"
    );

    if (botonPrueba) {
        botonPrueba.disabled = !googleDriveDisponible();
    }
}

function iniciarGoogleDrive() {

    const menu = document.getElementById(
        "panelMenuAjustes"
    );

    if (!menu) {
        console.error("No se encontro el menu.");
        return;
    }

    if (document.getElementById(
        "btnConectarGoogleDrive"
    )) {
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
        titulo.after(
            boton,
            estado,
            botonPrueba,
            selector
        );
    } else {
        menu.prepend(
            boton,
            estado,
            botonPrueba,
            selector
        );
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

                        if (
                            respuesta.error ||
                            !respuesta.access_token
                        ) {
                            actualizarEstadoGoogleDrive(
                                "Error de autorizacion"
                            );

                            console.error(respuesta);
                            return;
                        }

                        googleAccessToken =
                            respuesta.access_token;

                        googleTokenExpira =
                            Date.now() +
                            Math.max(
                                0,
                                (Number(
                                    respuesta.expires_in
                                ) || 3600) - 60
                            ) * 1000;

                        boton.textContent =
                            "Reconectar Google Drive";

                        actualizarEstadoGoogleDrive(
                            "Google Drive conectado"
                        );

                        console.log(
                            "Google Drive autorizado."
                        );
                    }

                });
        }

        googleTokenClient.requestAccessToken({
            prompt: googleDriveDisponible()
                ? ""
                : "consent"
        });

    });

    botonPrueba.addEventListener("click", () => {
        if (!googleDriveDisponible()) {
            actualizarEstadoGoogleDrive(
                "Debes reconectar Google Drive"
            );
            return;
        }

        selector.click();
    });

    selector.addEventListener("change", async () => {

        const archivo = selector.files?.[0];

        if (!archivo) return;

        botonPrueba.disabled = true;

        actualizarEstadoGoogleDrive(
            "Subiendo archivo de prueba..."
        );

        try {

            const resultado =
                await subirArchivoGoogleDrive(archivo);

            actualizarEstadoGoogleDrive(
                "Archivo de prueba subido correctamente"
            );

            alert(
                "Archivo subido a Google Drive.\n\n" +
                "Nombre: " + resultado.name + "\n" +
                "ID: " + resultado.id
            );

        } catch (error) {

            console.error(error);

            actualizarEstadoGoogleDrive(
                "Error al subir archivo"
            );

            alert(
                "No se pudo subir el archivo:\n" +
                error.message
            );

        } finally {

            selector.value = "";

            botonPrueba.disabled =
                !googleDriveDisponible();
        }
    });
}

// ==========================================
// SUBIR ARCHIVO A GOOGLE DRIVE
// ==========================================

async function subirArchivoGoogleDrive(archivo) {

    if (!googleDriveDisponible()) {
        throw new Error(
            "Google Drive desconectado o sesion vencida."
        );
    }

    if (!(archivo instanceof Blob)) {
        throw new Error(
            "El archivo no tiene un formato valido."
        );
    }

    const nombre = archivo.name || "archivo";

    const tipo = archivo.type ||
        "application/octet-stream";

    const metadata = {
        name: nombre,
        mimeType: tipo
    };

    const separador =
        "mi_galeria_" +
        crypto.randomUUID().replaceAll("-", "");

    const encabezado =
        "--" + separador + "\r\n" +
        "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
        JSON.stringify(metadata) + "\r\n" +
        "--" + separador + "\r\n" +
        "Content-Type: " + tipo + "\r\n\r\n";

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

    let resultado;

    try {
        resultado = await respuesta.json();
    } catch {
        throw new Error(
            "Google Drive devolvio una respuesta invalida."
        );
    }

    if (!respuesta.ok) {

        if (respuesta.status === 401) {
            googleAccessToken = null;
            googleTokenExpira = 0;

            actualizarEstadoGoogleDrive(
                "Sesion vencida. Reconecta Google Drive."
            );
        }

        throw new Error(
            resultado.error?.message ||
            "Error HTTP " + respuesta.status
        );
    }

    if (!resultado.id) {
        throw new Error(
            "Google Drive no devolvio el ID del archivo."
        );
    }

    return resultado;
}

// ==========================================
// ACCESO DESDE OTROS ARCHIVOS JAVASCRIPT
// ==========================================

window.MiGaleriaGoogleDrive = {
    disponible: googleDriveDisponible,
    subirArchivo: subirArchivoGoogleDrive,
    actualizarEstado: actualizarEstadoGoogleDrive
};

document.addEventListener(
    "DOMContentLoaded",
    iniciarGoogleDrive
);
