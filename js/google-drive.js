
"use strict";

/* ==========================================
   MI GALERIA - GOOGLE DRIVE
   Conexion OAuth, subida y consulta
========================================== */

const GOOGLE_CLIENT_ID =
    "103011390287-u2coot9i3p4h1p0r3dd1mmm8ifaub559.apps.googleusercontent.com";

const GOOGLE_DRIVE_SCOPE =
    "https://www.googleapis.com/auth/drive.file";

let googleTokenClient = null;
let googleAccessToken = null;
let googleTokenExpira = 0;

/* ==========================================
   COMPROBAR CONEXION
========================================== */

function googleDriveDisponible() {
    return Boolean(
        googleAccessToken &&
        Date.now() < googleTokenExpira
    );
}

/* ==========================================
   ACTUALIZAR ESTADO
========================================== */

function actualizarEstadoGoogleDrive(mensaje) {

    const estado = document.getElementById(
        "estadoGoogleDrive"
    );

    if (estado) {
        estado.textContent = mensaje;
    }

    const conectado = googleDriveDisponible();

    const botonPrueba = document.getElementById(
        "btnPruebaGoogleDrive"
    );

    const botonListar = document.getElementById(
        "btnListarGoogleDrive"
    );

    if (botonPrueba) {
        botonPrueba.disabled = !conectado;
    }

    if (botonListar) {
        botonListar.disabled = !conectado;
    }
}

/* ==========================================
   INICIAR GOOGLE DRIVE
========================================== */

function iniciarGoogleDrive() {

    const menu = document.getElementById(
        "panelMenuAjustes"
    );

    if (!menu) {
        console.error("No se encontro el menu de ajustes.");
        return;
    }

    if (document.getElementById(
        "btnConectarGoogleDrive"
    )) {
        return;
    }

    /* BOTON CONECTAR */

    const boton = document.createElement("button");

    boton.id = "btnConectarGoogleDrive";
    boton.type = "button";
    boton.textContent = "Conectar Google Drive";

    /* ESTADO */

    const estado = document.createElement("div");

    estado.id = "estadoGoogleDrive";
    estado.style.fontSize = "12px";
    estado.style.padding = "8px";
    estado.textContent = "Google Drive desconectado";

    /* BOTON SUBIR PRUEBA */

    const botonPrueba = document.createElement("button");

    botonPrueba.id = "btnPruebaGoogleDrive";
    botonPrueba.type = "button";
    botonPrueba.textContent = "Subir prueba a Google Drive";
    botonPrueba.disabled = true;

    /* BOTON CONSULTAR ARCHIVOS */

    const botonListar = document.createElement("button");

    botonListar.id = "btnListarGoogleDrive";
    botonListar.type = "button";
    botonListar.textContent = "Consultar archivos de Google Drive";
    botonListar.disabled = true;

    /* SELECTOR DE ARCHIVOS */

    const selector = document.createElement("input");

    selector.type = "file";
    selector.accept = "image/*,video/*";
    selector.style.display = "none";

    /* INSERTAR CONTROLES */

    const titulo = menu.querySelector(
        ".menu-ajustes-titulo"
    );

    if (titulo) {

        titulo.after(
            boton,
            estado,
            botonPrueba,
            botonListar,
            selector
        );

    } else {

        menu.prepend(
            boton,
            estado,
            botonPrueba,
            botonListar,
            selector
        );
    }

    /* ======================================
       CONECTAR CON GOOGLE
    ====================================== */

    boton.addEventListener("click", () => {

        if (!window.google?.accounts?.oauth2) {

            alert("Google OAuth aun no ha cargado.");
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

                        window.dispatchEvent(
                            new Event("miGaleriaDriveConectado")
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

    /* ======================================
       CONSULTAR ARCHIVOS
    ====================================== */

    botonListar.addEventListener("click", async () => {

        botonListar.disabled = true;

        actualizarEstadoGoogleDrive(
            "Consultando archivos..."
        );

        try {

            const archivos =
                await listarArchivosGoogleDrive();

            console.table(
                archivos.map(archivo => ({

                    nombre: archivo.name,

                    tipo: archivo.mimeType,

                    id: archivo.id,

                    carpetaPadre:
                        (archivo.parents || []).join(", ")

                }))
            );

            actualizarEstadoGoogleDrive(
                "Consulta completada: " +
                archivos.length +
                " archivo(s)."
            );

            alert(
                "Consulta completada.\n\n" +
                "Archivos encontrados: " +
                archivos.length +
                "\n\n" +
                "Presiona F12 y abre Console " +
                "para ver los resultados.\n\n" +
                "No se modifico ningun archivo."
            );

        } catch (error) {

            console.error(
                "Error consultando Google Drive:",
                error
            );

            actualizarEstadoGoogleDrive(
                "Error al consultar Google Drive"
            );

            alert(
                "No se pudo consultar Google Drive:\n" +
                error.message
            );

        } finally {

            botonListar.disabled =
                !googleDriveDisponible();
        }

    });

    /* ======================================
       SELECCIONAR ARCHIVO DE PRUEBA
    ====================================== */

    botonPrueba.addEventListener("click", () => {

        if (!googleDriveDisponible()) {

            actualizarEstadoGoogleDrive(
                "Debes reconectar Google Drive"
            );

            return;
        }

        selector.click();
    });

    /* ======================================
       SUBIR ARCHIVO DE PRUEBA
    ====================================== */

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

/* ==========================================
   SUBIR ARCHIVO A GOOGLE DRIVE
========================================== */

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

/* ==========================================
   CONSULTAR ARCHIVOS DE GOOGLE DRIVE
========================================== */

async function listarArchivosGoogleDrive() {

    if (!googleDriveDisponible()) {

        throw new Error(
            "Debes conectar Google Drive primero."
        );
    }

    const archivos = [];

    let pagina = "";

    do {

        const parametros = new URLSearchParams({

            pageSize: "1000",

            fields:
                "nextPageToken,files(" +
                "id,name,mimeType,parents,size," +
                "createdTime,modifiedTime,trashed)",

            q: "trashed = false",

            spaces: "drive"

        });

        if (pagina) {
            parametros.set("pageToken", pagina);
        }

        const respuesta = await fetch(

            "https://www.googleapis.com/drive/v3/files?" +
            parametros.toString(),

            {
                headers: {
                    Authorization:
                        "Bearer " + googleAccessToken
                }
            }
        );

        let datos;

        try {

            datos = await respuesta.json();

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
                datos.error?.message ||
                "Error HTTP " + respuesta.status
            );
        }

        archivos.push(...(datos.files || []));

        pagina = datos.nextPageToken || "";

    } while (pagina);

    return archivos;
}

/* ==========================================
   FUNCIONES DISPONIBLES PARA OTROS JS
========================================== */

window.MiGaleriaGoogleDrive = {

    disponible: googleDriveDisponible,

    subirArchivo: subirArchivoGoogleDrive,

    listarArchivos: listarArchivosGoogleDrive,

    actualizarEstado: actualizarEstadoGoogleDrive

};

/* ==========================================
   INICIALIZAR
========================================== */

document.addEventListener(
    "DOMContentLoaded",
    iniciarGoogleDrive
);



/* ==========================================
   DESCARGAR ARCHIVO DESDE GOOGLE DRIVE
========================================== */

async function descargarArchivoGoogleDrive(driveId) {

    if (!googleDriveDisponible()) {
        throw new Error(
            "Debes conectar Google Drive primero."
        );
    }

    if (!driveId || typeof driveId !== "string") {
        throw new Error(
            "El ID del archivo de Drive no es valido."
        );
    }

    const respuesta = await fetch(
        "https://www.googleapis.com/drive/v3/files/" +
        encodeURIComponent(driveId) +
        "?alt=media",
        {
            headers: {
                Authorization:
                    "Bearer " + googleAccessToken
            }
        }
    );

    if (!respuesta.ok) {

        if (respuesta.status === 401) {
            googleAccessToken = null;
            googleTokenExpira = 0;

            actualizarEstadoGoogleDrive(
                "Sesion vencida. Reconecta Google Drive."
            );
        }

        throw new Error(
            "No se pudo descargar el archivo. " +
            "Error HTTP " + respuesta.status
        );
    }

    return await respuesta.blob();
}

/* ==========================================
   EXPONER FUNCION DE DESCARGA
========================================== */

window.MiGaleriaGoogleDrive.descargarArchivo =
    descargarArchivoGoogleDrive;
