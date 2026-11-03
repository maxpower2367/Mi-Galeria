
/* MI GALERIA - BOVEDA CRYPTOMATOR
   Version 2: respaldo incremental y restauracion.
   Requiere Chrome/Edge y unidad desbloqueada.
*/

(() => {
    "use strict";

    const ARCHIVO_META = "mi-galeria-boveda-v2.json";
    const CARPETA_MEDIOS = "Mi-Galeria-Medios";
    const CLAVE_STATS = "MiGaleriaComparativasV1";

    let raiz = null;
    let ocupado = false;

    const $e = id => document.getElementById(id);

    const estado = mensaje => {
        if ($e("respaldoEstado")) {
            $e("respaldoEstado").textContent = mensaje;
        }
    };

    const disponible = () => !!raiz;

    function ocupadoUI(valor) {
        ocupado = valor;

        for (const id of [
            "btnConectarBoveda",
            "btnGuardarBoveda",
            "btnRestaurarBoveda"
        ]) {
            if ($e(id)) $e(id).disabled = valor;
        }
    }

    async function conectar() {
        if (ocupado) return;

        if (!window.showDirectoryPicker) {
            alert(
                "Necesitas Chrome o Edge con acceso a carpetas " +
                "desde localhost o HTTPS."
            );
            return;
        }

        try {
            const seleccion = await window.showDirectoryPicker({
                mode: "readwrite"
            });

            const mensaje =
                "¿La carpeta seleccionada pertenece a la unidad " +
                "DESBLOQUEADA de Cryptomator (por ejemplo G:\\)?\n\n" +
                "No selecciones Documentos\\Bovedas-Cryptomator " +
                "ni una carpeta cifrada de MEGA.\n\n" +
                "Ubicacion seleccionada: " + seleccion.name;

            if (!confirm(mensaje)) return;

            let permiso = await seleccion.queryPermission({
                mode: "readwrite"
            });

            if (permiso !== "granted") {
                permiso = await seleccion.requestPermission({
                    mode: "readwrite"
                });
            }

            if (permiso !== "granted") {
                throw new Error(
                    "No se concedio permiso de escritura."
                );
            }

            raiz = seleccion;

            $e("btnConectarBoveda").textContent =
                "🔐 Cryptomator conectado";

            estado(
                "Boveda conectada. Para respaldar toda la " +
                "galeria pulsa 'Guardar en boveda'."
            );

        } catch (error) {
            if (error.name !== "AbortError") {
                alert("No se pudo conectar: " + error.message);
            }
        }
    }

    async function obtenerMedios() {
        if (!raiz) {
            throw new Error("Conecta primero Cryptomator.");
        }

        return raiz.getDirectoryHandle(
            CARPETA_MEDIOS,
            { create: true }
        );
    }

    async function existeArchivo(dir, nombre) {
        try {
            return await dir.getFileHandle(nombre);
        } catch (error) {
            if (error.name === "NotFoundError") {
                return null;
            }
            throw error;
        }
    }

    async function escribir(dir, nombre, datos) {
        const handle = await dir.getFileHandle(
            nombre,
            { create: true }
        );

        const writer = await handle.createWritable();

        try {
            await writer.write(datos);
            await writer.close();
        } catch (error) {
            try {
                await writer.abort();
            } catch (_) {}

            throw error;
        }
    }

    async function copiarArchivoABoveda(archivo) {
        const medios = await obtenerMedios();
        const nombre = archivo.id + ".bin";

        const previo = await existeArchivo(medios, nombre);

        if (previo) {
            const existente = await previo.getFile();

            if (existente.size === archivo.datos.size) {
                return true;
            }

            throw new Error(
                "Ya existe un archivo con el mismo ID " +
                "y diferente tamano: " + nombre
            );
        }

        await escribir(medios, nombre, archivo.datos);

        return true;
    }

    function cursorSiguiente(ultima) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(
                "archivos",
                "readonly"
            );

            const rango = ultima === undefined
                ? null
                : IDBKeyRange.lowerBound(ultima, true);

            const req = tx.objectStore("archivos")
                .openCursor(rango);

            req.onsuccess = () => {
                resolve(
                    req.result
                        ? {
                            key: req.result.key,
                            value: req.result.value
                        }
                        : null
                );
            };

            req.onerror = () => reject(req.error);
        });
    }

    async function guardarBoveda() {
        if (!raiz) {
            alert("Primero pulsa 'Conectar Cryptomator'.");
            return;
        }

        if (ocupado) return;

        ocupadoUI(true);

        try {
            const carpetas = await obtenerTodos("carpetas");
            const listado = [];

            let ultima;
            let numero = 0;

            while (true) {
                const siguiente = await cursorSiguiente(ultima);

                if (!siguiente) break;

                ultima = siguiente.key;

                const archivo = siguiente.value;

                if (!(archivo.datos instanceof Blob)) {
                    throw new Error(
                        "Archivo sin datos: " + archivo.nombre
                    );
                }

                await copiarArchivoABoveda(archivo);

                listado.push({
                    id: archivo.id,
                    nombre: archivo.nombre,
                    tipo: archivo.tipo,
                    carpeta: archivo.carpeta,
                    fecha: archivo.fecha,
                    archivo: archivo.id + ".bin",
                    tamano: archivo.datos.size
                });

                numero++;

                estado(
                    "Guardando en Cryptomator: " +
                    numero + " archivo(s)..."
                );
            }

            let comparativas = [];

            try {
                comparativas = JSON.parse(
                    localStorage.getItem(CLAVE_STATS) || "[]"
                );
            } catch (_) {}

            const manifiesto = {
                formato: "MiGaleriaBoveda",
                version: 2,
                fecha: new Date().toISOString(),
                carpetas,
                archivos: listado,
                comparativas
            };

            // Escribir metadatos solo despues de copiar medios.
            await escribir(
                raiz,
                ARCHIVO_META,
                JSON.stringify(manifiesto, null, 2)
            );

            estado(
                "Respaldo terminado: " +
                carpetas.length + " carpetas y " +
                numero + " archivos. Espera a MEGA."
            );

            alert(
                "Guardado en Cryptomator completado.\n" +
                carpetas.length + " carpetas y " +
                numero + " archivos.\n" +
                "Espera a que MEGA sincronice."
            );

        } catch (error) {
            console.error(error);

            estado(
                "Respaldo NO completado: " + error.message
            );

            alert(
                "No se completo el respaldo: " +
                error.message
            );

        } finally {
            ocupadoUI(false);
        }
    }

    async function restaurarBoveda() {
        if (!raiz) {
            alert("Primero conecta la boveda desbloqueada.");
            return;
        }

        if (ocupado) return;

        ocupadoUI(true);

        try {
            const [localCarpetas, localArchivos] =
                await Promise.all([
                    obtenerTodos("carpetas"),
                    obtenerTodos("archivos")
                ]);

            if (
                localCarpetas.length ||
                localArchivos.length
            ) {
                alert(
                    "Por seguridad, la restauracion solo se " +
                    "permite en una galeria VACIA.\n" +
                    "Usa otro perfil de Chrome para probarla.\n" +
                    "No borres tu galeria actual."
                );
                return;
            }

            const handle = await raiz.getFileHandle(
                ARCHIVO_META
            );

            const datos = JSON.parse(
                await (await handle.getFile()).text()
            );

            if (
                datos.formato !== "MiGaleriaBoveda" ||
                datos.version !== 2 ||
                !Array.isArray(datos.carpetas) ||
                !Array.isArray(datos.archivos)
            ) {
                throw new Error("Manifiesto incompatible.");
            }

            const idsCarpetas = new Set();

            for (const carpeta of datos.carpetas) {
                if (
                    typeof carpeta.id !== "string" ||
                    idsCarpetas.has(carpeta.id)
                ) {
                    throw new Error(
                        "ID de carpeta invalido o repetido."
                    );
                }

                idsCarpetas.add(carpeta.id);
            }

            const idsArchivos = new Set();

            const medios = await raiz.getDirectoryHandle(
                CARPETA_MEDIOS
            );

            // Verificar todos los archivos antes de importar.
            for (const archivo of datos.archivos) {
                if (
                    typeof archivo.id !== "string" ||
                    idsArchivos.has(archivo.id) ||
                    archivo.archivo !== archivo.id + ".bin" ||
                    !Number.isSafeInteger(archivo.tamano) ||
                    archivo.tamano < 0
                ) {
                    throw new Error(
                        "Entrada invalida del manifiesto."
                    );
                }

                idsArchivos.add(archivo.id);

                if (
                    archivo.carpeta != null &&
                    !idsCarpetas.has(archivo.carpeta)
                ) {
                    throw new Error(
                        "Carpeta inexistente: " + archivo.nombre
                    );
                }

                const archivoFisico = await (
                    await medios.getFileHandle(archivo.archivo)
                ).getFile();

                if (
                    archivoFisico.size !== archivo.tamano
                ) {
                    throw new Error(
                        "Tamano incorrecto: " + archivo.nombre
                    );
                }
            }

            for (const carpeta of datos.carpetas) {
                if (
                    carpeta.padre != null &&
                    !idsCarpetas.has(carpeta.padre)
                ) {
                    throw new Error(
                        "Carpeta padre inexistente."
                    );
                }
            }

            if (!confirm(
                "Se encontraron " +
                datos.carpetas.length + " carpetas y " +
                datos.archivos.length + " archivos.\n" +
                "¿Restaurar en esta galeria VACIA?"
            )) {
                return;
            }

            for (const carpeta of datos.carpetas) {
                await guardar("carpetas", carpeta);
            }

            let numero = 0;

            for (const archivo of datos.archivos) {
                const fisico = await (
                    await medios.getFileHandle(archivo.archivo)
                ).getFile();

                await guardar("archivos", {
                    id: archivo.id,
                    nombre: archivo.nombre,
                    tipo: archivo.tipo,
                    carpeta: archivo.carpeta,
                    fecha: archivo.fecha,
                    datos: new File(
                        [fisico],
                        archivo.nombre,
                        {
                            type: archivo.tipo ||
                                "application/octet-stream"
                        }
                    )
                });

                numero++;

                estado(
                    "Restaurando " + numero +
                    "/" + datos.archivos.length
                );
            }

            if (Array.isArray(datos.comparativas)) {
                localStorage.setItem(
                    CLAVE_STATS,
                    JSON.stringify(datos.comparativas)
                );
            }

            await mostrarContenido();

            estado(
                "Restauracion completada: " +
                numero + " archivos."
            );

            alert(
                "Restauracion completada. " +
                "Comprueba carpetas, imagenes y videos."
            );

        } catch (error) {
            console.error(error);

            estado(
                "Restauracion interrumpida: " +
                error.message
            );

            alert(
                "Restauracion interrumpida: " +
                error.message +
                ". No vuelvas a importar sin revisar " +
                "el estado actual."
            );

        } finally {
            ocupadoUI(false);
        }
    }

    window.MiGaleriaCryptomator = {
        disponible,
        copiarArchivoABoveda
    };

    $e("btnConectarBoveda").addEventListener(
        "click",
        conectar
    );

    $e("btnGuardarBoveda").addEventListener(
        "click",
        guardarBoveda
    );

    $e("btnRestaurarBoveda").addEventListener(
        "click",
        restaurarBoveda
    );
})();
