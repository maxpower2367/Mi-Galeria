
/* ==========================================
   MI GALERIA - SUBIDA DE PENDIENTES
   Archivo: js/subida-pendientes.js
========================================== */

(() => {
    "use strict";

    const ID_BOTON = "btnSubirPendientesDrive";
    const ID_ESTADO = "estadoSubidaPendientesDrive";

    let subiendo = false;

    const el = id => document.getElementById(id);

    /* ======================================
       MOSTRAR ESTADO
    ====================================== */


function mostrarEstado(mensaje) {
    const estado = el(ID_ESTADO);

    if (estado) {
        estado.textContent = mensaje;
    }

    console.log("[Mi Galeria Drive]", mensaje);

    if (subiendo) {
        window.MiGaleriaNotificaciones?.progreso(
            mensaje
        );
    }
}


    /* ======================================
       OBTENER ARCHIVOS PENDIENTES
    ====================================== */

    async function obtenerPendientes() {
        const archivos = await obtenerTodos("archivos");

        return archivos.filter(archivo =>
            !archivo.driveId &&
            archivo.datos instanceof Blob
        );
    }

    /* ======================================
       SUBIR ARCHIVOS PENDIENTES
    ====================================== */

    async function subirPendientes() {
        if (subiendo) return;

        const drive = window.MiGaleriaGoogleDrive;

        if (!drive?.disponible?.()) {
            alert(
                "Primero conecta Google Drive " +
                "desde el menu de ajustes."
            );
            return;
        }

        if (!drive.subirArchivo) {
            alert(
                "La funcion de subida de Google Drive " +
                "no esta disponible."
            );
            return;
        }

        let pendientes;

        try {
            pendientes = await obtenerPendientes();
        } catch (error) {
            alert(
                "No se pudieron consultar los archivos: " +
                error.message
            );
            return;
        }

        if (pendientes.length === 0) {
            mostrarEstado(
                "No hay archivos locales pendientes."
            );

            alert(
                "Todos los archivos locales tienen " +
                "una referencia a Google Drive."
            );
            return;
        }

        const confirmar = confirm(
            "SUBIR ARCHIVOS A GOOGLE DRIVE\n\n" +
            "Archivos pendientes: " +
            pendientes.length + "\n\n" +
            "Se subiran los originales a Google Drive.\n" +
            "Se guardara el ID de cada subida exitosa.\n" +
            "No se eliminaran los originales locales.\n\n" +
            "El tiempo dependera del tamano de los " +
            "archivos y de tu conexion.\n\n" +
            "¿Iniciar subida?"
        );

        if (!confirmar) return;

        subiendo = true;

        const boton = el(ID_BOTON);

        if (boton) boton.disabled = true;

        let completados = 0;
        let fallidos = 0;
        let omitidos = 0;

        const errores = [];

        try {
            const total = pendientes.length;

            for (let i = 0; i < total; i++) {
                const archivo = pendientes[i];

                mostrarEstado(
                    "Subiendo " + (i + 1) +
                    " de " + total + ": " +
                    archivo.nombre
                );

                try {
                    /*
                       Comprobar nuevamente el registro
                       antes de subirlo.
                    */

                    const tx = db.transaction(
                        "archivos",
                        "readonly"
                    );

                    const actual = await new Promise(
                        (resolve, reject) => {
                            const solicitud = tx
                                .objectStore("archivos")
                                .get(archivo.id);

                            solicitud.onsuccess = () =>
                                resolve(solicitud.result);

                            solicitud.onerror = () =>
                                reject(solicitud.error);
                        }
                    );

                    if (!actual) {
                        omitidos++;
                        continue;
                    }

                    if (actual.driveId) {
                        omitidos++;
                        continue;
                    }

                    if (!(actual.datos instanceof Blob)) {
                        throw new Error(
                            "El original local no esta disponible."
                        );
                    }

                    /*
                       Preparar el archivo original.
                    */

                    const datos = new File(
                        [actual.datos],
                        actual.nombre,
                        {
                            type:
                                actual.tipo ||
                                actual.datos.type ||
                                "application/octet-stream"
                        }
                    );

                    /*
                       Subir a Google Drive.
                    */

                    const resultado =
                        await drive.subirArchivo(datos);

                    if (!resultado?.id) {
                        throw new Error(
                            "Google Drive no devolvio el ID."
                        );
                    }

                    /*
                       Guardar la referencia en IndexedDB.

                       Conservamos todos los demas datos,
                       incluyendo el original local.
                    */

                    await guardar("archivos", {
                        ...actual,
                        driveId: resultado.id,
                        sincronizacion: "sincronizado"
                    });

                    completados++;

                    mostrarEstado(
                        "Completados: " + completados +
                        " / " + total +
                        " | Fallidos: " + fallidos
                    );

                } catch (error) {
                    fallidos++;

                    console.error(
                        "Error subiendo:",
                        archivo.nombre,
                        error
                    );

                    errores.push({
                        nombre: archivo.nombre,
                        error: error.message
                    });
                }
            }

            /*
               Mostrar el resumen.

               No actualizamos automaticamente los
               metadatos de la galeria para evitar
               sobrescribir un respaldo anterior
               sin confirmacion.
            */

            mostrarEstado(
                "Subida terminada. " +
                "Completados: " + completados +
                ", fallidos: " + fallidos +
                ", omitidos: " + omitidos
            );

            if (errores.length) {
                console.table(errores);
            }


const resumen =
    "Subidos y registrados: " + completados + "\n" +
    "Fallidos: " + fallidos + "\n" +
    "Omitidos: " + omitidos + "\n\n" +
    "Los originales locales se conservaron.\n" +
    "Recuerda guardar la estructura en Google Drive.";

if (fallidos > 0) {
    window.MiGaleriaNotificaciones.error(
        "Subida terminada con errores.\n\n" +
        resumen +
        "\n\nRevisa la consola F12."
    );
} else {
    window.MiGaleriaNotificaciones.exito(
        "Subida finalizada correctamente.\n\n" +
        resumen
    );
}


        } finally {
            subiendo = false;

            if (boton) {
                boton.disabled = false;
            }
        }
    }

    /* ======================================
       CREAR BOTON EN MENU DE AJUSTES
    ====================================== */

    function iniciar() {
        const menu = el("panelMenuAjustes");

        if (!menu || el(ID_BOTON)) {
            return;
        }

        const boton = document.createElement("button");

        boton.id = ID_BOTON;
        boton.type = "button";

        boton.textContent =
            "Subir pendientes a Google Drive";

        boton.addEventListener(
            "click",
            subirPendientes
        );

        const estado = document.createElement("div");

        estado.id = ID_ESTADO;

        estado.style.cssText =
            "font-size:12px;" +
            "padding:6px 8px;" +
            "overflow-wrap:anywhere;";

        estado.textContent =
            "Subida de archivos pendientes disponible";

        const referencia = el(
            "btnRecuperarDrive"
        );

        if (referencia) {
            referencia.after(boton, estado);
        } else {
            menu.append(boton, estado);
        }
    }

    /* ======================================
       INICIALIZACION
    ====================================== */

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            iniciar
        );
    } else {
        iniciar();
    }

})();
