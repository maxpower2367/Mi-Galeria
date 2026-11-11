
/* ==========================================
   MI GALERIA - RECUPERACION DESDE GOOGLE DRIVE
   Archivo: recuperacion-drive.js
========================================== */

(() => {
    "use strict";

    const ID_BOTON = "btnRecuperarDrive";
    const ID_ESTADO = "estadoRecuperacionDrive";

    let trabajando = false;

    /* ======================================
       ELEMENTOS
    ====================================== */

    const el = id => document.getElementById(id);

    function estado(mensaje) {
        const nodo = el(ID_ESTADO);

        if (nodo) {
            nodo.textContent = mensaje;
        }
    }

    /* ======================================
       VALIDAR ESTRUCTURA
    ====================================== */

    function validar(datos) {
        if (
            !datos ||
            datos.formato !== "MiGaleriaDrive" ||
            datos.version !== 1 ||
            !Array.isArray(datos.carpetas) ||
            !Array.isArray(datos.archivos)
        ) {
            throw new Error(
                "El archivo de estructura no tiene " +
                "un formato compatible."
            );
        }

        const carpetas = new Set();
        const archivos = new Set();

        /* VALIDAR CARPETAS */

        for (const carpeta of datos.carpetas) {
            if (
                !carpeta ||
                typeof carpeta.id !== "string" ||
                !carpeta.id ||
                carpetas.has(carpeta.id) ||
                typeof carpeta.nombre !== "string"
            ) {
                throw new Error(
                    "Hay carpetas duplicadas o invalidas " +
                    "en el respaldo."
                );
            }

            carpetas.add(carpeta.id);
        }

        /* VALIDAR JERARQUIA */

        for (const carpeta of datos.carpetas) {
            if (
                carpeta.padre != null &&
                !carpetas.has(carpeta.padre)
            ) {
                throw new Error(
                    "El respaldo contiene carpetas " +
                    "con padres inexistentes."
                );
            }
        }

        /* VALIDAR ARCHIVOS */

        for (const archivo of datos.archivos) {
            if (
                !archivo ||
                typeof archivo.id !== "string" ||
                !archivo.id ||
                archivos.has(archivo.id) ||
                typeof archivo.nombre !== "string" ||
                (
                    archivo.carpeta != null &&
                    !carpetas.has(archivo.carpeta)
                )
            ) {
                throw new Error(
                    "El respaldo contiene archivos invalidos."
                );
            }

            archivos.add(archivo.id);
        }
    }

    /* ======================================
       RECUPERAR DESDE GOOGLE DRIVE
    ====================================== */

    async function recuperar() {
        if (trabajando) return;

        const drive = window.MiGaleriaGoogleDrive;

        /* COMPROBAR GOOGLE DRIVE */

        if (!drive?.disponible?.()) {

            window.MiGaleriaNotificaciones.error(
                "Primero conecta Google Drive " +
                "desde el menu de ajustes."
            );


            return;
        }

        /* COMPROBAR INDEXEDDB */

        if (typeof db === "undefined" || !db) {

            window.MiGaleriaNotificaciones.error(
                "La base de datos local aun no esta lista."
            );


            return;
        }

        trabajando = true;

        el(ID_BOTON).disabled = true;

        try {
            /* BUSCAR METADATOS */

            estado(
                "Buscando estructura en Google Drive..."
            );

            const meta = await drive.buscarMetadatos();

            if (!meta) {
                throw new Error(
                    "No existe mi-galeria-metadata.json. " +
                    "Guarda primero la estructura desde " +
                    "el equipo original."
                );
            }

            /* DESCARGAR METADATOS */

            const blob = await drive.descargarArchivo(
                meta.id
            );

            const datos = JSON.parse(
                await blob.text()
            );

            validar(datos);

            /* CONSULTAR REGISTROS LOCALES */

            const localesCarpetas =
                await obtenerTodos("carpetas");

            const localesArchivos =
                await obtenerTodos("archivos");

            const idsCarpetas = new Set(
                localesCarpetas.map(
                    carpeta => carpeta.id
                )
            );

            const idsArchivos = new Set(
                localesArchivos.map(
                    archivo => archivo.id
                )
            );

            const driveIds = new Set(
                localesArchivos
                    .map(archivo => archivo.driveId)
                    .filter(Boolean)
            );

            /* DETECTAR CARPETAS NUEVAS */

            const nuevasCarpetas =
                datos.carpetas.filter(
                    carpeta =>
                        !idsCarpetas.has(carpeta.id)
                );

            /* DETECTAR ARCHIVOS NUEVOS */

            const nuevosArchivos =
                datos.archivos.filter(
                    archivo =>
                        typeof archivo.driveId === "string" &&
                        archivo.driveId &&
                        !idsArchivos.has(archivo.id) &&
                        !driveIds.has(archivo.driveId)
                );

            /* ESTADISTICAS */

            const sinCopia =
                datos.archivos.filter(
                    archivo => !archivo.driveId
                ).length;

            const omitidos =
                datos.archivos.length -
                nuevosArchivos.length;

            /* CONFIRMACION */

            const aceptar = confirm(
                "RECUPERACION DESDE GOOGLE DRIVE\n\n" +

                "Carpetas en respaldo: " +
                datos.carpetas.length + "\n" +

                "Archivos en respaldo: " +
                datos.archivos.length + "\n" +

                "Carpetas nuevas: " +
                nuevasCarpetas.length + "\n" +

                "Archivos nuevos con referencia a Drive: " +
                nuevosArchivos.length + "\n" +

                "Archivos omitidos: " +
                omitidos + "\n" +

                "Sin copia registrada en Drive: " +
                sinCopia + "\n\n" +

                "Se agregaran solamente registros nuevos.\n" +

                "No se borraran ni sobrescribiran " +
                "registros existentes.\n" +

                "Los archivos originales se descargaran " +
                "al abrirlos.\n\n" +

                "¿Continuar?"
            );

            if (!aceptar) {
                estado(
                    "Recuperacion cancelada. " +
                    "No se modifico nada."
                );

                return;
            }

            /* ==================================
               GUARDAR EN INDEXEDDB

               UNA SOLA TRANSACCION
               PARA EVITAR IMPORTACIONES
               PARCIALES.
            ================================== */

            await ejecutarTransaccion(
                ["carpetas", "archivos"],
                tx => {

                    const storeCarpetas =
                        tx.objectStore("carpetas");

                    const storeArchivos =
                        tx.objectStore("archivos");

                    /* RECUPERAR CARPETAS */

                    for (const carpeta of nuevasCarpetas) {
                        storeCarpetas.add({
                            id: carpeta.id,

                            nombre: carpeta.nombre,

                            padre: carpeta.padre ?? null,

                            fecha: carpeta.fecha ?? null,

                            portadaSinImagen:
                                carpeta.portadaSinImagen === true,

                            portadaArchivoId:
                                carpeta.portadaArchivoId ?? null
                        });
                    }

                    /* RECUPERAR ARCHIVOS */

                    for (const archivo of nuevosArchivos) {
                        storeArchivos.add({
                            id: archivo.id,

                            nombre: archivo.nombre,

                            tipo:
                                archivo.tipo ||
                                "application/octet-stream",

                            carpeta:
                                archivo.carpeta ?? null,

                            fecha:
                                archivo.fecha ?? null,

                            driveId: archivo.driveId,

                            sincronizacion: "sincronizado"
                        });
                    }
                }
            );

            /* RECUPERACION FINALIZADA */

            estado(
                "Recuperacion completada: " +
                nuevasCarpetas.length +
                " carpetas y " +
                nuevosArchivos.length +
                " archivos agregados."
            );


            window.MiGaleriaNotificaciones.exito(
                "Recuperacion completada.\n\n" +
                "Carpetas agregadas: " +
                nuevasCarpetas.length + "\n" +
                "Archivos agregados: " +
                nuevosArchivos.length + "\n\n" +
                "Actualiza la pagina para verlos."
            );


        } catch (error) {

            console.error(
                "Error al recuperar desde Google Drive:",
                error
            );

            estado(
                "Error: " + error.message
            );


            window.MiGaleriaNotificaciones.error(
                "No se pudo completar la recuperacion:\n" +
                error.message
            );


        } finally {

            trabajando = false;

            const boton = el(ID_BOTON);

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

        /* BOTON RECUPERAR */

        const boton = document.createElement("button");

        boton.id = ID_BOTON;

        boton.type = "button";

        boton.textContent =
            "Recuperar galeria desde Google Drive";

        boton.addEventListener(
            "click",
            recuperar
        );

        /* ESTADO */

        const mensaje = document.createElement("div");

        mensaje.id = ID_ESTADO;

        mensaje.style.cssText =
            "font-size:12px;padding:6px 8px;";

        mensaje.textContent =
            "Recuperacion disponible al conectar Drive";

        /* UBICACION EN EL MENU */

        const referencia = el(
            "btnGuardarMetadatosDrive"
        );

        if (referencia) {
            referencia.after(
                boton,
                mensaje
            );

        } else {
            menu.append(
                boton,
                mensaje
            );
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
