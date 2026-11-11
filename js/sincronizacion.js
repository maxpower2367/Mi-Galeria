
/* ==========================================
   MI GALERIA - SINCRONIZACION BIDIRECCIONAL
   Archivo: sincronizacion.js

   Sincroniza estructura entre PC y celular.
   No elimina archivos fisicos de Google Drive.
   Detiene cambios simultaneos incompatibles.
========================================== */

(() => {
    "use strict";

    const CLAVE = "MiGaleriaSyncBaseV1";
    const INTERVALO = 8000;

    let ocupado = false;
    let detenido = false;
    let avisoMostrado = false;

    const drive = () => window.MiGaleriaGoogleDrive;

    const orden = (a, b) => a.id.localeCompare(b.id);

    const normalizar = datos => ({
        carpetas: (datos.carpetas || []).map(c => ({
            id: c.id,
            nombre: c.nombre,
            padre: c.padre ?? null,
            fecha: c.fecha || null,
            portadaSinImagen: c.portadaSinImagen === true,
            portadaArchivoId: c.portadaArchivoId || null
        })).sort(orden),

        archivos: (datos.archivos || []).map(a => ({
            id: a.id,
            nombre: a.nombre,
            tipo: a.tipo,
            carpeta: a.carpeta ?? null,
            fecha: a.fecha || null,
            driveId: a.driveId || null
        })).sort(orden)
    });

    const huella = datos =>
        JSON.stringify(normalizar(datos));

    const leerBase = () =>
        localStorage.getItem(CLAVE);

    const guardarBase = datos =>
        localStorage.setItem(CLAVE, huella(datos));

    const estado = mensaje => {
        console.info("[Sincronizacion] " + mensaje);
        drive()?.actualizarEstado?.(mensaje);
    };

    const fallar = mensaje => {
        detenido = true;

        estado("Sincronizacion detenida: revisar consola");

        console.error("[Sincronizacion] " + mensaje);

        if (!avisoMostrado) {
            avisoMostrado = true;

            alert(
                "Mi Galeria detuvo la sincronizacion " +
                "para proteger tus datos.\n\n" +
                mensaje
            );
        }
    };

    /* ======================================
       LEER METADATOS REMOTOS
    ====================================== */

    async function remoto() {
        const archivo = await drive().buscarMetadatos();

        if (!archivo) {
            throw new Error(
                "No existe mi-galeria-metadata.json en Drive."
            );
        }

        const blob = await drive().descargarArchivo(
            archivo.id
        );

        const datos = JSON.parse(await blob.text());

        if (
            datos.formato !== "MiGaleriaDrive" ||
            datos.version !== 1 ||
            !Array.isArray(datos.carpetas) ||
            !Array.isArray(datos.archivos)
        ) {
            throw new Error(
                "Metadatos de Drive incompatibles."
            );
        }

        return datos;
    }

    /* ======================================
       LEER DATOS LOCALES
    ====================================== */

    async function local() {
        return {
            carpetas: await obtenerTodos("carpetas"),
            archivos: await obtenerTodos("archivos")
        };
    }

    /* ======================================
       VALIDAR ESTRUCTURA
    ====================================== */

    function validar(datos) {
        const carpetas = new Set();
        const archivos = new Set();

        for (const c of datos.carpetas) {
            if (
                !c ||
                typeof c.id !== "string" ||
                typeof c.nombre !== "string" ||
                carpetas.has(c.id)
            ) {
                throw new Error(
                    "Carpeta invalida o repetida en Drive."
                );
            }

            carpetas.add(c.id);
        }

        for (const c of datos.carpetas) {
            if (
                c.padre != null &&
                !carpetas.has(c.padre)
            ) {
                throw new Error(
                    "Carpeta con padre inexistente: " +
                    c.nombre
                );
            }
        }

        for (const a of datos.archivos) {
            if (
                !a ||
                typeof a.id !== "string" ||
                typeof a.nombre !== "string" ||
                archivos.has(a.id)
            ) {
                throw new Error(
                    "Archivo invalido o repetido en Drive."
                );
            }

            archivos.add(a.id);

            if (
                a.carpeta != null &&
                !carpetas.has(a.carpeta)
            ) {
                throw new Error(
                    "Archivo con carpeta inexistente: " +
                    a.nombre
                );
            }
        }
    }

    /* ======================================
       APLICAR CAMBIOS REMOTOS
    ====================================== */

    async function aplicar(datos) {
        validar(datos);

        const actuales = await local();

        const carpetasPrevias = new Map(
            actuales.carpetas.map(c => [c.id, c])
        );

        const archivosPrevios = new Map(
            actuales.archivos.map(a => [a.id, a])
        );

        const carpetasNuevas = datos.carpetas.map(c => ({
            ...(carpetasPrevias.get(c.id) || {}),
            id: c.id,
            nombre: c.nombre,
            padre: c.padre ?? null,
            fecha: c.fecha || Date.now(),
            portadaSinImagen:
                c.portadaSinImagen === true,
            portadaArchivoId:
                c.portadaArchivoId || null
        }));

        const archivosNuevos = datos.archivos.map(a => ({
            ...(archivosPrevios.get(a.id) || {}),
            id: a.id,
            nombre: a.nombre,
            tipo: a.tipo,
            carpeta: a.carpeta ?? null,
            fecha: a.fecha || Date.now(),
            driveId: a.driveId || null,
            sincronizacion:
                a.driveId ? "sincronizado" : "pendiente"
        }));

        await ejecutarTransaccion(
            ["carpetas", "archivos"],
            tx => {
                const cs = tx.objectStore("carpetas");
                const as = tx.objectStore("archivos");

                const idsC = new Set(
                    carpetasNuevas.map(c => c.id)
                );

                const idsA = new Set(
                    archivosNuevos.map(a => a.id)
                );

                for (const c of actuales.carpetas) {
                    if (!idsC.has(c.id)) {
                        cs.delete(c.id);
                    }
                }

                for (const a of actuales.archivos) {
                    if (!idsA.has(a.id)) {
                        as.delete(a.id);
                    }
                }

                for (const c of carpetasNuevas) {
                    cs.put(c);
                }

                for (const a of archivosNuevos) {
                    as.put(a);
                }
            }
        );

        if (typeof mostrarContenido === "function") {
            await mostrarContenido();
        }
    }

    /* ======================================
       PUBLICAR CAMBIOS EN DRIVE
    ====================================== */

    async function publicar(datos) {
        validar(datos);

        const ahora = await remoto();
        const base = leerBase();

        if (
            base !== null &&
            huella(ahora) !== base
        ) {
            throw new Error(
                "Drive cambio durante el guardado. " +
                "Se detuvo para evitar sobrescribir cambios."
            );
        }

        await drive().guardarMetadatos();

        guardarBase(datos);

        estado("Cambios guardados en Google Drive");
    }

    /* ======================================
       CICLO DE SINCRONIZACION
    ====================================== */

    async function ciclo() {
        if (
            ocupado ||
            detenido ||
            !drive()?.disponible?.() ||
            typeof db === "undefined" ||
            !db
        ) {
            return;
        }

        ocupado = true;

        try {
            const [nube, equipo] = await Promise.all([
                remoto(),
                local()
            ]);

            validar(nube);

            const hNube = huella(nube);
            const hEquipo = huella(equipo);
            const base = leerBase();

            if (base === null) {
                if (hNube === hEquipo) {
                    guardarBase(nube);

                    estado(
                        "Sincronizacion inicial lista"
                    );

                } else if (
                    !equipo.carpetas.length &&
                    !equipo.archivos.length
                ) {
                    await aplicar(nube);

                    guardarBase(nube);

                    estado(
                        "Galeria recuperada desde Drive"
                    );

                } else {
                    fallar(
                        "Este dispositivo tiene datos " +
                        "locales distintos de Drive. " +
                        "Exporta un respaldo y limpia " +
                        "su galeria local antes de sincronizar."
                    );
                }

            } else if (
                hNube === base &&
                hEquipo === base
            ) {
                // No hay cambios.

            } else if (
                hNube !== base &&
                hEquipo === base
            ) {
                await aplicar(nube);

                guardarBase(nube);

                estado(
                    "Cambios recibidos desde Google Drive"
                );

            } else if (
                hNube === base &&
                hEquipo !== base
            ) {
                await publicar(equipo);

            } else if (hNube === hEquipo) {
                guardarBase(nube);

            } else {
                fallar(
                    "Hay cambios distintos en este " +
                    "dispositivo y en Drive. " +
                    "No se sobrescribio ninguno. " +
                    "Conserva ambos respaldos."
                );
            }

        } catch (error) {
            console.error(
                "[Sincronizacion]",
                error
            );

            if (
                /cambio durante el guardado/i.test(
                    error.message
                )
            ) {
                fallar(error.message);

            } else {
                estado(
                    "Error de sincronizacion; reintentando"
                );
            }

        } finally {
            ocupado = false;
        }
    }

    /* ======================================
       BLOQUEAR GUARDADO ANTIGUO
    ====================================== */

    if (drive()) {
        drive().guardarEstructuraAutomatica =
            async () => {
                await ciclo();

                return {
                    sincronizacion:
                        detenido
                            ? "detenida"
                            : "comprobada"
                };
            };
    }

    /* ======================================
       EXPONER FUNCIONES
    ====================================== */

    window.MiGaleriaSincronizacion = {
        sincronizar: ciclo,

        reanudar: () => {
            detenido = false;
            avisoMostrado = false;

            return ciclo();
        }
    };

    /* ======================================
       EVENTOS AUTOMATICOS
    ====================================== */

    window.addEventListener(
        "miGaleriaDriveConectado",
        () => {
            void ciclo();
        }
    );

    window.addEventListener(
        "focus",
        () => {
            void ciclo();
        }
    );

    setInterval(
        () => {
            void ciclo();
        },
        INTERVALO
    );

    setTimeout(
        () => {
            void ciclo();
        },
        1500
    );

})();
