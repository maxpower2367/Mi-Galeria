
"use strict";

/* ==========================================
   MI GALERIA - GOOGLE DRIVE
   Archivo: google-drive.js

   Conexion OAuth
   Subida y descarga de archivos
   Miniaturas bajo demanda
   Metadatos y estructura
========================================== */

/* ==========================================
   CONFIGURACION
========================================== */

const GOOGLE_CLIENT_ID =
    "103011390287-u2coot9i3p4h1p0r3dd1mmm8ifaub559.apps.googleusercontent.com";

const GOOGLE_DRIVE_SCOPE =
    "https://www.googleapis.com/auth/drive.file";

const MI_GALERIA_METADATA =
    "mi-galeria-metadata.json";

let googleTokenClient = null;
let googleAccessToken = null;
let googleTokenExpira = 0;

/* ==========================================
   MINIATURAS
========================================== */

const googleMiniaturasCache = new Map();
const googleMiniaturasPendientes = new Map();

const GOOGLE_MAX_MINIATURAS = 150;

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

    [
        "btnPruebaGoogleDrive",
        "btnListarGoogleDrive",
        "btnGuardarMetadatosDrive"
    ].forEach(id => {

        const boton = document.getElementById(id);

        if (boton) {
            boton.disabled = !conectado;
        }
    });
}

/* ==========================================
   CONTROLAR RESPUESTAS
========================================== */

async function procesarRespuestaGoogleDrive(
    respuesta,
    mensajeError = "Error de Google Drive"
) {

    let datos = {};

    try {
        datos = await respuesta.json();
    } catch (_) {
        // Algunas respuestas no contienen JSON.
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
            mensajeError +
            " (HTTP " + respuesta.status + ")"
        );
    }

    return datos;
}

/* ==========================================
   PETICIONES AUTORIZADAS
========================================== */

async function peticionGoogleDrive(
    url,
    opciones = {}
) {

    if (!googleDriveDisponible()) {

        throw new Error(
            "Google Drive desconectado o sesion vencida."
        );
    }

    const headers = new Headers(
        opciones.headers || {}
    );

    headers.set(
        "Authorization",
        "Bearer " + googleAccessToken
    );

    const respuesta = await fetch(url, {
        ...opciones,
        headers
    });

    if (respuesta.status === 401) {

        googleAccessToken = null;
        googleTokenExpira = 0;

        actualizarEstadoGoogleDrive(
            "Sesion vencida. Reconecta Google Drive."
        );
    }

    return respuesta;
}

/* ==========================================
   SUBIR ARCHIVO
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

    const respuesta = await peticionGoogleDrive(
        "https://www.googleapis.com/upload/drive/v3/files" +
        "?uploadType=multipart&fields=id,name,mimeType",
        {
            method: "POST",

            headers: {
                "Content-Type":
                    "multipart/related; boundary=" +
                    separador
            },

            body: cuerpo
        }
    );

    const resultado = await procesarRespuestaGoogleDrive(
        respuesta,
        "No se pudo subir el archivo"
    );

    if (!resultado.id) {

        throw new Error(
            "Google Drive no devolvio el ID del archivo."
        );
    }

    return resultado;
}

/* ==========================================
   LISTAR ARCHIVOS
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
                "createdTime,modifiedTime,trashed," +
                "thumbnailLink,hasThumbnail)",

            q: "trashed = false",

            spaces: "drive"
        });

        if (pagina) {
            parametros.set("pageToken", pagina);
        }

        const respuesta = await peticionGoogleDrive(
            "https://www.googleapis.com/drive/v3/files?" +
            parametros.toString()
        );

        const datos = await procesarRespuestaGoogleDrive(
            respuesta,
            "No se pudieron consultar los archivos"
        );

        archivos.push(...(datos.files || []));

        pagina = datos.nextPageToken || "";

    } while (pagina);

    return archivos;
}

/* ==========================================
   DESCARGAR ARCHIVO ORIGINAL
========================================== */

async function descargarArchivoGoogleDrive(driveId) {

    if (
        !driveId ||
        typeof driveId !== "string"
    ) {

        throw new Error(
            "El ID del archivo de Drive no es valido."
        );
    }

    const respuesta = await peticionGoogleDrive(
        "https://www.googleapis.com/drive/v3/files/" +
        encodeURIComponent(driveId) +
        "?alt=media"
    );

    if (!respuesta.ok) {

        throw new Error(
            "No se pudo descargar el archivo. " +
            "Error HTTP " + respuesta.status
        );
    }

    return await respuesta.blob();
}

/* ==========================================
   OBTENER INFORMACION DE UN ARCHIVO
========================================== */

async function obtenerInformacionArchivoGoogleDrive(
    driveId
) {

    if (
        !driveId ||
        typeof driveId !== "string"
    ) {

        throw new Error(
            "ID de Drive no valido."
        );
    }

    const parametros = new URLSearchParams({

        fields:
            "id,name,mimeType,size," +
            "thumbnailLink,hasThumbnail,trashed"
    });

    const respuesta = await peticionGoogleDrive(
        "https://www.googleapis.com/drive/v3/files/" +
        encodeURIComponent(driveId) +
        "?" + parametros.toString()
    );

    return await procesarRespuestaGoogleDrive(
        respuesta,
        "No se pudo obtener la informacion del archivo"
    );
}

/* ==========================================
   LIMPIAR CACHE DE MINIATURAS
========================================== */

function limpiarCacheMiniaturasGoogleDrive() {

    googleMiniaturasCache.forEach(url => {
        URL.revokeObjectURL(url);
    });

    googleMiniaturasCache.clear();
}

/* ==========================================
   GUARDAR MINIATURA EN CACHE
========================================== */

function guardarMiniaturaEnCache(driveId, blob) {

    if (!(blob instanceof Blob)) {
        return null;
    }

    if (googleMiniaturasCache.has(driveId)) {

        const anterior = googleMiniaturasCache.get(
            driveId
        );

        URL.revokeObjectURL(anterior);

        googleMiniaturasCache.delete(driveId);
    }

    const url = URL.createObjectURL(blob);

    googleMiniaturasCache.set(driveId, url);

    while (
        googleMiniaturasCache.size >
        GOOGLE_MAX_MINIATURAS
    ) {

        const primera = googleMiniaturasCache.keys()
            .next().value;

        const urlAntigua = googleMiniaturasCache.get(
            primera
        );

        URL.revokeObjectURL(urlAntigua);

        googleMiniaturasCache.delete(primera);
    }

    return url;
}

/* ==========================================
   DESCARGAR MINIATURA DE GOOGLE DRIVE

   Google Drive puede generar una miniatura
   para imagenes y videos compatibles.

   No descargamos el archivo original
   para generar esta miniatura.
========================================== */



/* ==========================================
   GENERAR MINIATURA DE VIDEO
   COMPATIBLE CON ANDROID Y PC
========================================== */

const VIDEO_MINIATURA_MAX_BYTES = 30 * 1024 * 1024;

async function crearMiniaturaVideoGoogleDrive(
    driveId,
    informacion
) {

    const tamano = Number(informacion.size || 0);

    // No descargar videos grandes para miniaturas.
    if (
        tamano > VIDEO_MINIATURA_MAX_BYTES
    ) {
        return null;
    }

    const original = await descargarArchivoGoogleDrive(
        driveId
    );

    if (
        !original.size ||
        original.size > VIDEO_MINIATURA_MAX_BYTES
    ) {
        return null;
    }

    const tipo = informacion.mimeType || "video/mp4";

    const videoBlob = original.type.startsWith("video/")
        ? original
        : new Blob([original], { type: tipo });

    const url = URL.createObjectURL(videoBlob);

    const video = document.createElement("video");

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.preload = "auto";

    try {

        return await new Promise((resolver, rechazar) => {

            let terminado = false;
            let capturando = false;
            let intentos = 0;

            const temporizador = setTimeout(() => {
                finalizar(
                    new Error("Tiempo agotado al generar miniatura")
                );
            }, 20000);

            function finalizar(error, blob = null) {

                if (terminado) return;

                terminado = true;
                clearTimeout(temporizador);

                if (error) {
                    rechazar(error);
                } else {
                    resolver(blob);
                }
            }

            function capturar() {

                if (terminado || capturando) return;

                if (
                    video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
                    !video.videoWidth ||
                    !video.videoHeight
                ) {
                    return;
                }

                capturando = true;

                try {

                    const limite = 400;

                    const escala = Math.min(
                        1,
                        limite / Math.max(
                            video.videoWidth,
                            video.videoHeight
                        )
                    );

                    const canvas = document.createElement("canvas");

                    canvas.width = Math.max(
                        1,
                        Math.round(video.videoWidth * escala)
                    );

                    canvas.height = Math.max(
                        1,
                        Math.round(video.videoHeight * escala)
                    );

                    const contexto = canvas.getContext("2d", {
                        willReadFrequently: true
                    });

                    if (!contexto) {
                        throw new Error("Canvas no disponible");
                    }

                    contexto.drawImage(
                        video,
                        0,
                        0,
                        canvas.width,
                        canvas.height
                    );

                    // Detectar fotogramas completamente negros.
                    const datos = contexto.getImageData(
                        0,
                        0,
                        canvas.width,
                        canvas.height
                    ).data;

                    let brillo = 0;
                    let muestras = 0;

                    for (let i = 0; i < datos.length; i += 160) {

                        brillo += datos[i] +
                            datos[i + 1] +
                            datos[i + 2];

                        muestras++;
                    }

                    const promedio = muestras
                        ? brillo / (muestras * 3)
                        : 0;

                    if (
                        promedio < 4 &&
                        intentos < 2 &&
                        Number.isFinite(video.duration) &&
                        video.duration > 2
                    ) {

                        intentos++;
                        capturando = false;

                        const siguiente = Math.min(
                            video.duration - 0.1,
                            Math.max(
                                video.currentTime + 1,
                                video.duration * 0.3
                            )
                        );

                        video.currentTime = siguiente;

                        return;
                    }

                    canvas.toBlob(blob => {

                        if (!blob) {
                            finalizar(
                                new Error(
                                    "No se pudo convertir la miniatura"
                                )
                            );
                            return;
                        }

                        finalizar(null, blob);

                    }, "image/jpeg", 0.85);

                } catch (error) {

                    finalizar(error);
                }
            }

            video.onerror = () => {
                finalizar(
                    new Error(
                        "El navegador no pudo procesar el video"
                    )
                );
            };

            video.onloadedmetadata = () => {

                if (terminado) return;

                const duracion = video.duration;

                if (
                    Number.isFinite(duracion) &&
                    duracion > 1
                ) {

                    const posicion = Math.min(
                        1,
                        duracion / 2
                    );

                    video.currentTime = posicion;

                } else {

                    capturar();
                }
            };

            video.onloadeddata = capturar;
            video.onseeked = capturar;

            video.src = url;
            video.load();

        });

    } finally {

        video.pause();
        video.removeAttribute("src");
        video.load();

        URL.revokeObjectURL(url);
    }
}


/* ==========================================
   OBTENER MINIATURA DE GOOGLE DRIVE

   Evita solicitudes directas a thumbnailLink
   que pueden ser bloqueadas por CORS.

   Las imagenes se obtienen mediante la API
   autenticada de Google Drive.

   Los videos no se descargan completos
   para generar miniaturas.
========================================== */



/* ==========================================
   CREAR MINIATURA REDUCIDA
   - JPEG y WebP: miniatura ligera
   - PNG: conserva transparencia
   - GIF: conserva animacion original
========================================== */

async function crearMiniaturaReducidaGoogleDrive(blob) {

    if (!(blob instanceof Blob)) {
        throw new Error("Imagen no valida.");
    }

    const tipo = blob.type.toLowerCase();

    // Conservar GIF animados sin modificarlos.
    if (tipo === "image/gif") {
        return blob;
    }

    // Mantener otros formatos no contemplados.
    if (
        tipo !== "image/jpeg" &&
        tipo !== "image/png" &&
        tipo !== "image/webp"
    ) {
        return blob;
    }

    const imagen = await createImageBitmap(blob);

    try {

        const limite = 400;

        const escala = Math.min(
            1,
            limite / Math.max(
                imagen.width,
                imagen.height
            )
        );

        const ancho = Math.max(
            1,
            Math.round(imagen.width * escala)
        );

        const alto = Math.max(
            1,
            Math.round(imagen.height * escala)
        );

        const canvas = document.createElement("canvas");

        canvas.width = ancho;
        canvas.height = alto;

        const contexto = canvas.getContext("2d");

        if (!contexto) {
            throw new Error(
                "No se pudo crear el contexto de imagen."
            );
        }

        contexto.drawImage(
            imagen,
            0,
            0,
            ancho,
            alto
        );

        // PNG conserva transparencia.
        // JPEG y WebP se convierten a WebP ligero.
        const formato = tipo === "image/png"
            ? "image/png"
            : "image/webp";

        return await new Promise((resolver, rechazar) => {

            canvas.toBlob(
                resultado => {

                    if (resultado) {
                        resolver(resultado);
                    } else {
                        rechazar(
                            new Error(
                                "No se pudo generar la miniatura."
                            )
                        );
                    }
                },
                formato,
                0.8
            );
        });

    } finally {

        imagen.close();
    }
}



/* ==========================================
   CACHE PERSISTENTE DE MINIATURAS
   INDEXEDDB - MI GALERIA
========================================== */

const MINIATURAS_LIMITE_REGISTROS = 300;
const MINIATURAS_LIMITE_BYTES = 50 * 1024 * 1024;
const MINIATURA_LIMITE_INDIVIDUAL = 5 * 1024 * 1024;

/* OBTENER MINIATURA GUARDADA */

async function obtenerMiniaturaPersistente(driveId) {

    if (!db || !db.objectStoreNames.contains("miniaturas")) {
        return null;
    }

    try {
        const registro = await obtenerRegistro(
            "miniaturas",
            driveId
        );

        if (!registro || !(registro.blob instanceof Blob)) {
            return null;
        }

        // Actualizar fecha de uso sin bloquear la visualizacion.
        guardar("miniaturas", {
            ...registro,
            ultimoAcceso: Date.now()
        }).catch(error => {
            console.warn("No se pudo actualizar acceso:", error);
        });

        return registro.blob;

    } catch (error) {
        console.warn(
            "No se pudo leer la cache de miniaturas:",
            error
        );
        return null;
    }
}

/* LIMITAR ESPACIO DE CACHE */

async function limitarCachePersistente() {

    if (!db || !db.objectStoreNames.contains("miniaturas")) {
        return;
    }

    const registros = await obtenerTodos("miniaturas");

    let totalBytes = registros.reduce(
        (total, registro) =>
            total + (registro.blob?.size || 0),
        0
    );

    if (
        registros.length <= MINIATURAS_LIMITE_REGISTROS &&
        totalBytes <= MINIATURAS_LIMITE_BYTES
    ) {
        return;
    }

    registros.sort(
        (a, b) =>
            (a.ultimoAcceso || 0) -
            (b.ultimoAcceso || 0)
    );

    const eliminarIds = [];

    let cantidad = registros.length;

    for (const registro of registros) {

        if (
            cantidad <= MINIATURAS_LIMITE_REGISTROS &&
            totalBytes <= MINIATURAS_LIMITE_BYTES
        ) {
            break;
        }

        eliminarIds.push(registro.id);
        cantidad--;
        totalBytes -= registro.blob?.size || 0;
    }

    if (eliminarIds.length === 0) {
        return;
    }

    await ejecutarTransaccion(
        ["miniaturas"],
        tx => {
            const almacen = tx.objectStore("miniaturas");

            eliminarIds.forEach(id => {
                almacen.delete(id);
            });
        }
    );
}

/* GUARDAR MINIATURA EN INDEXEDDB */

async function guardarMiniaturaPersistente(driveId, blob) {

    if (
        !db ||
        !db.objectStoreNames.contains("miniaturas") ||
        !(blob instanceof Blob) ||
        blob.size === 0 ||
        blob.size > MINIATURA_LIMITE_INDIVIDUAL
    ) {
        return;
    }

    try {
        await guardar("miniaturas", {
            id: driveId,
            blob: blob,
            ultimoAcceso: Date.now()
        });

        await limitarCachePersistente();

    } catch (error) {
        console.warn(
            "No se pudo guardar la miniatura persistente:",
            error
        );
    }
}





/* ==========================================
   OBTENER MINIATURA DE GOOGLE DRIVE
   1. Revisar cache en memoria
   2. Revisar IndexedDB
   3. Descargar desde Google Drive
   4. Generar y guardar miniatura
========================================== */

async function obtenerMiniaturaGoogleDrive(driveId) {

    if (
        typeof driveId !== "string" ||
        !driveId.trim()
    ) {
        return null;
    }

    /* CACHE EN MEMORIA */

    if (googleMiniaturasCache.has(driveId)) {
        return googleMiniaturasCache.get(driveId);
    }

    /* EVITAR CARGAS DUPLICADAS */

    if (googleMiniaturasPendientes.has(driveId)) {
        return googleMiniaturasPendientes.get(driveId);
    }

    const tarea = (async () => {

        /* CACHE PERSISTENTE EN INDEXEDDB */

        const guardada = await obtenerMiniaturaPersistente(
            driveId
        );

        if (guardada) {

            console.log(
                "Miniatura recuperada de IndexedDB:",
                driveId
            );

            return guardarMiniaturaEnCache(
                driveId,
                guardada
            );
        }

        /* GOOGLE DRIVE */

        if (!googleDriveDisponible()) {
            return null;
        }

        let informacion;

        try {

            informacion =
                await obtenerInformacionArchivoGoogleDrive(
                    driveId
                );

            if (informacion.trashed) {
                return null;
            }

        } catch (error) {

            console.warn(
                "No se pudo consultar el archivo:",
                driveId,
                error
            );

            return null;
        }

        const tipo = informacion.mimeType || "";


/* ======================================
   MINIATURAS DE VIDEOS
====================================== */

if (tipo.startsWith("video/")) {

    try {

        const miniatura =
            await crearMiniaturaVideoGoogleDrive(
                driveId,
                informacion
            );

        if (!miniatura) {
            return null;
        }

        await guardarMiniaturaPersistente(
            driveId,
            miniatura
        );

        return guardarMiniaturaEnCache(
            driveId,
            miniatura
        );

    } catch (error) {

        console.warn(
            "No se pudo generar miniatura del video:",
            driveId,
            error
        );

        return null;
    }
}

/* ======================================
   OTROS ARCHIVOS NO COMPATIBLES
====================================== */

if (!tipo.startsWith("image/")) {
    return null;
}


        try {

            /* DESCARGAR IMAGEN ORIGINAL */

            const original =
                await descargarArchivoGoogleDrive(
                    driveId
                );

            if (!original.size) {
                return null;
            }

            const imagen =
                original.type.startsWith("image/")
                    ? original
                    : new Blob(
                        [original],
                        { type: tipo }
                    );

            /* GENERAR MINIATURA */

            const miniatura =
                await crearMiniaturaReducidaGoogleDrive(
                    imagen
                );

            /* GUARDAR EN INDEXEDDB */

            await guardarMiniaturaPersistente(
                driveId,
                miniatura
            );

            /* GUARDAR EN MEMORIA */

            return guardarMiniaturaEnCache(
                driveId,
                miniatura
            );

        } catch (error) {

            console.warn(
                "No se pudo cargar la miniatura:",
                driveId,
                error
            );

            return null;
        }

    })();

    googleMiniaturasPendientes.set(
        driveId,
        tarea
    );

    try {
        return await tarea;

    } finally {
        googleMiniaturasPendientes.delete(
            driveId
        );
    }
}

/* ==========================================
   COLOCAR MINIATURA EN UNA IMAGEN HTML
========================================== */

async function cargarMiniaturaGoogleDrive(
    driveId,
    elementoImagen
) {

    if (
        !elementoImagen ||
        !(elementoImagen instanceof HTMLImageElement)
    ) {

        return false;
    }

    const url = await obtenerMiniaturaGoogleDrive(
        driveId
    );

    if (!url) {
        return false;
    }

    if (!elementoImagen.isConnected) {
        return false;
    }

    elementoImagen.src = url;

    return true;
}

/* ==========================================
   BUSCAR ARCHIVO DE METADATOS
========================================== */

async function buscarMetadatosGoogleDrive() {

    if (!googleDriveDisponible()) {

        throw new Error(
            "Google Drive no esta conectado."
        );
    }

    const archivos = await listarArchivosGoogleDrive();

    const coincidencias = archivos.filter(archivo =>
        archivo.name === MI_GALERIA_METADATA &&
        archivo.mimeType === "application/json"
    );

    if (coincidencias.length > 1) {

        throw new Error(
            "Existen varios archivos de metadatos. " +
            "No se actualizara ninguno para evitar errores."
        );
    }

    return coincidencias[0] || null;
}

/* ==========================================
   GENERAR METADATOS DE LA GALERIA
========================================== */

async function generarMetadatosGaleria() {

    const carpetas = await obtenerTodos("carpetas");

    const archivos = await obtenerTodos("archivos");

    return {

        formato: "MiGaleriaDrive",

        version: 1,

        actualizado: new Date().toISOString(),

        carpetas: carpetas.map(carpeta => ({

            id: carpeta.id,

            nombre: carpeta.nombre,

            padre: carpeta.padre ?? null,

            fecha: carpeta.fecha || null,

            portadaSinImagen:
                carpeta.portadaSinImagen === true,

            portadaArchivoId:
                typeof carpeta.portadaArchivoId === "string"
                    ? carpeta.portadaArchivoId
                    : null,

            portadaPendiente:
                carpeta.portadaPersonalizada instanceof Blob
        })),

        archivos: archivos.map(archivo => ({

            id: archivo.id,

            nombre: archivo.nombre,

            tipo: archivo.tipo,

            carpeta: archivo.carpeta ?? null,

            fecha: archivo.fecha || null,

            driveId: archivo.driveId || null,

            sincronizacion:
                archivo.sincronizacion || "pendiente"
        }))
    };
}

/* ==========================================
   GUARDAR METADATOS EN GOOGLE DRIVE
========================================== */

async function guardarMetadatosGoogleDrive() {

    if (!googleDriveDisponible()) {

        throw new Error(
            "Primero conecta Google Drive."
        );
    }

    const datos = await generarMetadatosGaleria();

    const existente = await buscarMetadatosGoogleDrive();

    const contenido = new Blob(
        [JSON.stringify(datos, null, 2)],
        {
            type: "application/json"
        }
    );

    /* CREAR METADATOS */

    if (!existente) {

        const archivo = new File(
            [contenido],
            MI_GALERIA_METADATA,
            {
                type: "application/json"
            }
        );

        const resultado =
            await subirArchivoGoogleDrive(archivo);

        return {

            id: resultado.id,

            creado: true,

            datos: datos
        };
    }

    /* ACTUALIZAR METADATOS EXISTENTES */

    const respuesta = await peticionGoogleDrive(
        "https://www.googleapis.com/upload/drive/v3/files/" +
        encodeURIComponent(existente.id) +
        "?uploadType=media&fields=id,name,mimeType",
        {
            method: "PATCH",

            headers: {
                "Content-Type": "application/json"
            },

            body: contenido
        }
    );

    const resultado = await procesarRespuestaGoogleDrive(
        respuesta,
        "No se pudieron actualizar los metadatos"
    );

    return {

        id: resultado.id || existente.id,

        creado: false,

        datos: datos
    };
}

/* ==========================================
   BOTON GUARDAR ESTRUCTURA
========================================== */

function iniciarBotonGuardarMetadatos() {

    const menu = document.getElementById(
        "panelMenuAjustes"
    );

    if (!menu) return;

    if (
        document.getElementById(
            "btnGuardarMetadatosDrive"
        )
    ) {

        return;
    }

    const boton = document.createElement("button");

    boton.id = "btnGuardarMetadatosDrive";

    boton.type = "button";

    boton.textContent =
        "Guardar estructura en Google Drive";

    boton.disabled = !googleDriveDisponible();

    boton.addEventListener("click", async () => {

        if (!googleDriveDisponible()) {

            alert("Primero conecta Google Drive.");
            return;
        }

        const confirmar = confirm(
            "Se guardara la estructura actual de carpetas, " +
            "archivos y portadas seleccionadas.\n\n" +
            "No se subiran imagenes ni videos pendientes.\n" +
            "No se duplicaran imagenes de portada.\n" +
            "No se eliminaran archivos.\n\n" +
            "El archivo de metadatos existente se " +
            "actualizara con la estructura LOCAL actual.\n\n" +
            "¿Continuar?"
        );

        if (!confirmar) return;

        boton.disabled = true;

        try {

            actualizarEstadoGoogleDrive(
                "Guardando estructura..."
            );

            const resultado =
                await guardarMetadatosGoogleDrive();

            actualizarEstadoGoogleDrive(
                "Estructura guardada en Drive"
            );

            const pendientes =
                resultado.datos.archivos.filter(
                    archivo => !archivo.driveId
                ).length;

            const portadasSeleccionadas =
                resultado.datos.carpetas.filter(
                    carpeta => carpeta.portadaArchivoId
                ).length;

            const portadasAntiguas =
                resultado.datos.carpetas.filter(
                    carpeta => carpeta.portadaPendiente
                ).length;


window.MiGaleriaNotificaciones.exito(
    "Estructura guardada correctamente.\n\n" +
    "Carpetas: " +
    resultado.datos.carpetas.length + "\n" +
    "Archivos registrados: " +
    resultado.datos.archivos.length + "\n" +
    "Portadas seleccionadas: " +
    portadasSeleccionadas + "\n" +
    "Archivos sin copia en Drive: " +
    pendientes + "\n" +
    "Portadas antiguas sin respaldo: " +
    portadasAntiguas + "\n\n" +
    "Las referencias de portadas se guardaron.\n" +
    "Las imagenes originales deben estar " +
    "disponibles para poder mostrarlas."
);


        } catch (error) {

            console.error(
                "Error guardando estructura:",
                error
            );

            actualizarEstadoGoogleDrive(
                "Error guardando estructura"
            );


window.MiGaleriaNotificaciones.error(
    "No se pudo guardar la estructura:\n" +
    error.message
);


        } finally {

            boton.disabled = !googleDriveDisponible();
        }
    });

    const referencia = document.getElementById(
        "btnListarGoogleDrive"
    );

    if (referencia) {

        referencia.after(boton);

    } else {

        menu.appendChild(boton);
    }
}

/* ==========================================
   CONTROLES DE GOOGLE DRIVE
========================================== */

function iniciarGoogleDrive() {

    const menu = document.getElementById(
        "panelMenuAjustes"
    );

    if (!menu) {

        console.error(
            "No se encontro el menu de ajustes."
        );

        return;
    }

    if (
        document.getElementById(
            "btnConectarGoogleDrive"
        )
    ) {

        return;
    }

    /* BOTON CONECTAR */

    const boton = document.createElement("button");

    boton.id = "btnConectarGoogleDrive";

    boton.type = "button";

    boton.textContent =
        "Conectar Google Drive";

    /* ESTADO */

    const estado = document.createElement("div");

    estado.id = "estadoGoogleDrive";

    estado.style.fontSize = "12px";
    estado.style.padding = "8px";

    estado.textContent =
        "Google Drive desconectado";

    /* BOTON DE PRUEBA */

    const botonPrueba =
        document.createElement("button");

    botonPrueba.id = "btnPruebaGoogleDrive";

    botonPrueba.type = "button";

    botonPrueba.textContent =
        "Subir prueba a Google Drive";

    botonPrueba.disabled = true;

    /* BOTON CONSULTAR */

    const botonListar =
        document.createElement("button");

    botonListar.id = "btnListarGoogleDrive";

    botonListar.type = "button";

    botonListar.textContent =
        "Consultar archivos de Google Drive";

    botonListar.disabled = true;

    /* SELECTOR DE ARCHIVOS */

    const selector =
        document.createElement("input");

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
   CONECTAR GOOGLE DRIVE
====================================== */

boton.addEventListener("click", () => {

    if (!window.google?.accounts?.oauth2) {

        window.MiGaleriaNotificaciones.error(
            "Google OAuth aun no ha cargado. Intenta nuevamente."
        );

        return;
    }

    if (!googleTokenClient) {

        googleTokenClient =
            google.accounts.oauth2.initTokenClient({

                client_id: GOOGLE_CLIENT_ID,

                scope: GOOGLE_DRIVE_SCOPE,

                callback: respuesta => {

                    /* ==============================
                       ERROR DE AUTORIZACION
                    ============================== */

                    if (
                        respuesta.error ||
                        !respuesta.access_token
                    ) {

                        actualizarEstadoGoogleDrive(
                            "Error de autorizacion"
                        );

                        window.MiGaleriaNotificaciones.error(
                            "No se pudo conectar Google Drive. Intenta nuevamente."
                        );

                        console.error(
                            "Error de autorizacion:",
                            respuesta
                        );

                        return;
                    }

                    /* ==============================
                       GUARDAR TOKEN DE GOOGLE DRIVE
                    ============================== */

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

                    /* ==============================
                       ACTUALIZAR INTERFAZ
                    ============================== */

                    boton.textContent =
                        "Reconectar Google Drive";

                    actualizarEstadoGoogleDrive(
                        "Google Drive conectado"
                    );

                    /* ==============================
                       NOTIFICACION DE EXITO
                    ============================== */

                    window.MiGaleriaNotificaciones.exito(
                        "Google Drive conectado correctamente."
                    );

                    /* ==============================
                       AVISAR AL RESTO DE LA GALERIA
                    ============================== */

                    window.dispatchEvent(
                        new Event(
                            "miGaleriaDriveConectado"
                        )
                    );
                }
            });
    }

    /* ==============================
       SOLICITAR AUTORIZACION
    ============================== */

    googleTokenClient.requestAccessToken({

        prompt: googleDriveDisponible()
            ? ""
            : "consent"
    });
});


    /* ======================================
       CONSULTAR ARCHIVOS
    ====================================== */

    botonListar.addEventListener(
        "click",
        async () => {

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
                            (archivo.parents || [])
                                .join(", "),

                        tieneMiniatura:
                            archivo.hasThumbnail === true
                    }))
                );

                actualizarEstadoGoogleDrive(
                    "Consulta completada: " +
                    archivos.length +
                    " archivo(s)."
                );


                    window.MiGaleriaNotificaciones.exito(
                        "Consulta de Google Drive completada.\n\n" +
                        "Archivos encontrados: " +
                        archivos.length + "\n\n" +
                        "Puedes ver los detalles en F12 > Console.\n" +
                        "No se modifico ningun archivo."
                    );


            } catch (error) {

                console.error(error);

                actualizarEstadoGoogleDrive(
                    "Error al consultar Google Drive"
                );


window.MiGaleriaNotificaciones.error(
    "Error al consultar Google Drive:\n" +
    error.message
);


            } finally {

                botonListar.disabled =
                    !googleDriveDisponible();
            }
        }
    );

    /* ======================================
       SUBIR ARCHIVO DE PRUEBA
    ====================================== */

    botonPrueba.addEventListener("click", () => {

        if (!googleDriveDisponible()) {

            alert(
                "Primero conecta Google Drive."
            );

            return;
        }

        selector.click();
    });

    selector.addEventListener(
        "change",
        async () => {

            const archivo = selector.files?.[0];

            if (!archivo) return;

            botonPrueba.disabled = true;

            actualizarEstadoGoogleDrive(
                "Subiendo archivo de prueba..."
            );

            try {

                const resultado =
                    await subirArchivoGoogleDrive(
                        archivo
                    );

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
        }
    );
}

/* ==========================================
   FUNCIONES PUBLICAS
========================================== */

window.MiGaleriaGoogleDrive = {

    disponible:
        googleDriveDisponible,

    subirArchivo:
        subirArchivoGoogleDrive,

    listarArchivos:
        listarArchivosGoogleDrive,

    actualizarEstado:
        actualizarEstadoGoogleDrive,

    descargarArchivo:
        descargarArchivoGoogleDrive,

    obtenerInformacionArchivo:
        obtenerInformacionArchivoGoogleDrive,

    obtenerMiniatura:
        obtenerMiniaturaGoogleDrive,

    cargarMiniatura:
        cargarMiniaturaGoogleDrive,

    limpiarCacheMiniaturas:
        limpiarCacheMiniaturasGoogleDrive,

    buscarMetadatos:
        buscarMetadatosGoogleDrive,

    generarMetadatos:
        generarMetadatosGaleria,

    guardarMetadatos:
        guardarMetadatosGoogleDrive
};

/* ==========================================
   INICIALIZACION
========================================== */

function inicializarControlesGoogleDrive() {

    iniciarGoogleDrive();

    iniciarBotonGuardarMetadatos();
}

if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        inicializarControlesGoogleDrive
    );

} else {

    inicializarControlesGoogleDrive();
}
