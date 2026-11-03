
/* ==========================================
   MI GALERIA - RESPALDOS
   Archivo: js/respaldo.js
========================================== */

(() => {
    "use strict";

    const CLAVE = "MiGaleriaComparativasV1";
    const META = "mi-galeria-respaldo.json";

    const elemento = id => document.getElementById(id);

    function estado(texto) {
        elemento("respaldoEstado").textContent = texto;
    }

    function habilitar(activo) {
        elemento("btnExportarRespaldo").disabled = !activo;
        elemento("btnImportarRespaldo").disabled = !activo;
    }

    function cursorSiguiente(almacen, ultima) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(almacen, "readonly");

            const rango = ultima === undefined
                ? null
                : IDBKeyRange.lowerBound(ultima, true);

            const solicitud = tx.objectStore(almacen)
                .openCursor(rango);

            solicitud.onsuccess = () => {
                const cursor = solicitud.result;

                resolve(cursor
                    ? { clave: cursor.key, valor: cursor.value }
                    : null
                );
            };

            solicitud.onerror = () => reject(solicitud.error);
        });
    }

    async function escribirJSON(directorio, nombre, datos) {
        const archivo = await directorio.getFileHandle(
            nombre,
            { create: true }
        );

        const escritor = await archivo.createWritable();

        try {
            await escritor.write(
                JSON.stringify(datos, null, 2)
            );
        } finally {
            await escritor.close();
        }
    }

    /* ======================================
       EXPORTAR RESPALDO
    ====================================== */

    async function exportar() {
        if (!window.showDirectoryPicker) {
            alert(
                "Utiliza Chrome o Edge de escritorio " +
                "desde HTTPS o Live Server."
            );
            return;
        }

        const directorio = await window.showDirectoryPicker({
            mode: "readwrite"
        });

        const existe = await directorio.getFileHandle(META)
            .then(() => true, () => false);

        if (existe) {
            alert(
                "Esta carpeta ya contiene un respaldo. " +
                "Selecciona una carpeta nueva y vacia."
            );
            return;
        }

        const medios = await directorio.getDirectoryHandle(
            "medios",
            { create: true }
        );

        const carpetas = await obtenerTodos("carpetas");

        let comparativas = [];

        try {
            comparativas = JSON.parse(
                localStorage.getItem(CLAVE) || "[]"
            );
        } catch (error) {
            console.warn(error);
        }

        const manifiesto = {
            formato: "MiGaleriaRespaldo",
            version: 1,
            fecha: new Date().toISOString(),
            carpetas,
            comparativas,
            archivos: []
        };

        let ultima;
        let cantidad = 0;

        while (true) {
            const resultado = await cursorSiguiente(
                "archivos",
                ultima
            );

            if (!resultado) break;

            ultima = resultado.clave;

            const archivo = resultado.valor;

            if (!(archivo.datos instanceof Blob)) {
                throw new Error(
                    "Archivo incompatible: " + archivo.nombre
                );
            }

            const nombre = String(archivo.id) + ".bin";

            const destino = await medios.getFileHandle(
                nombre,
                { create: true }
            );

            const escritor = await destino.createWritable();

            try {
                await escritor.write(archivo.datos);
            } finally {
                await escritor.close();
            }

            manifiesto.archivos.push({
                id: archivo.id,
                nombre: archivo.nombre,
                tipo: archivo.tipo,
                carpeta: archivo.carpeta,
                fecha: archivo.fecha,
                archivo: nombre,
                tamano: archivo.datos.size
            });

            cantidad++;

            estado("Exportados " + cantidad + " archivos...");
        }

        // El manifiesto se escribe al finalizar.
        await escribirJSON(
            directorio,
            META,
            manifiesto
        );

        estado(
            "Respaldo completado: " +
            cantidad + " archivos y " +
            carpetas.length + " carpetas."
        );

        alert(
            "Respaldo completado. Conserva toda la carpeta " +
            "y copiala dentro de tu boveda Cryptomator."
        );
    }

    /* ======================================
       IMPORTAR RESPALDO
    ====================================== */

    async function importar() {
        if (!window.showDirectoryPicker) {
            alert(
                "Utiliza Chrome o Edge de escritorio " +
                "para importar respaldos."
            );
            return;
        }

        const directorio = await window.showDirectoryPicker({
            mode: "read"
        });

        const archivoMeta = await directorio.getFileHandle(META);
        const archivo = await archivoMeta.getFile();

        const manifiesto = JSON.parse(await archivo.text());

        if (
            manifiesto.formato !== "MiGaleriaRespaldo" ||
            manifiesto.version !== 1 ||
            !Array.isArray(manifiesto.carpetas) ||
            !Array.isArray(manifiesto.archivos)
        ) {
            throw new Error("Formato de respaldo no valido.");
        }

        const medios = await directorio.getDirectoryHandle(
            "medios"
        );

        const ids = new Set();
        const nombres = new Set();

        for (const item of manifiesto.archivos) {
            if (
                !item ||
                typeof item.id !== "string" ||
                ids.has(item.id) ||
                typeof item.archivo !== "string" ||
                !/^[-\w]+\.bin$/.test(item.archivo) ||
                nombres.has(item.archivo)
            ) {
                throw new Error(
                    "El respaldo contiene archivos invalidos."
                );
            }

            ids.add(item.id);
            nombres.add(item.archivo);
        }

        const idsCarpetas = new Set();

        for (const carpeta of manifiesto.carpetas) {
            if (
                !carpeta ||
                typeof carpeta.id !== "string" ||
                idsCarpetas.has(carpeta.id)
            ) {
                throw new Error(
                    "El respaldo contiene carpetas invalidas."
                );
            }

            idsCarpetas.add(carpeta.id);
        }

        for (const carpeta of manifiesto.carpetas) {
            if (
                carpeta.padre != null &&
                !idsCarpetas.has(carpeta.padre)
            ) {
                throw new Error(
                    "Jerarquia de carpetas incompleta."
                );
            }
        }

        for (const item of manifiesto.archivos) {
            if (
                item.carpeta != null &&
                !idsCarpetas.has(item.carpeta)
            ) {
                throw new Error(
                    "Archivo con carpeta inexistente."
                );
            }
        }

        const confirmar = confirm(
            "Se importaran " +
            manifiesto.archivos.length + " archivos y " +
            manifiesto.carpetas.length + " carpetas.\n\n" +
            "Se crearan copias nuevas sin borrar los datos actuales.\n\n" +
            "¿Continuar?"
        );

        if (!confirmar) return;

        const mapa = new Map(
            manifiesto.carpetas.map(carpeta => [
                carpeta.id,
                crypto.randomUUID()
            ])
        );

        for (const carpeta of manifiesto.carpetas) {
            await guardar("carpetas", {
                ...carpeta,
                id: mapa.get(carpeta.id),
                padre: carpeta.padre == null
                    ? null
                    : mapa.get(carpeta.padre)
            });
        }

        let cantidad = 0;

        for (const item of manifiesto.archivos) {
            const handle = await medios.getFileHandle(
                item.archivo
            );

            const archivoOriginal = await handle.getFile();

            if (archivoOriginal.size !== item.tamano) {
                throw new Error(
                    "Tamano incorrecto en " + item.nombre +
                    ". La importacion quedo parcial."
                );
            }

            const datos = new File(
                [archivoOriginal],
                item.nombre,
                {
                    type: item.tipo || "application/octet-stream",
                    lastModified: Number(item.fecha) || Date.now()
                }
            );

            await guardar("archivos", {
                id: crypto.randomUUID(),
                nombre: item.nombre,
                tipo: item.tipo,
                carpeta: item.carpeta == null
                    ? null
                    : mapa.get(item.carpeta),
                fecha: item.fecha,
                datos
            });

            cantidad++;

            estado(
                "Importados " + cantidad + " de " +
                manifiesto.archivos.length + " archivos..."
            );
        }

        let actuales = [];

        try {
            actuales = JSON.parse(
                localStorage.getItem(CLAVE) || "[]"
            );

            if (!Array.isArray(actuales)) {
                actuales = [];
            }
        } catch (error) {
            console.warn(error);
        }

        const nuevas = (
            Array.isArray(manifiesto.comparativas)
                ? manifiesto.comparativas
                : []
        )
            .filter(c => c && Array.isArray(c.carpetas))
            .map(c => ({
                ...c,
                id: "comp-" + crypto.randomUUID(),
                carpetas: c.carpetas
                    .map(id => mapa.get(id))
                    .filter(Boolean)
            }));

        try {
            localStorage.setItem(
                CLAVE,
                JSON.stringify([...actuales, ...nuevas])
            );
        } catch (error) {
            console.warn(
                "No se restauraron las estadisticas.",
                error
            );
        }

        if (typeof mostrarContenido === "function") {
            await mostrarContenido();
        }

        estado(
            "Importacion finalizada: " +
            cantidad + " archivos."
        );

        alert(
            "Importacion completada. " +
            "Recarga la pagina para actualizar las estadisticas."
        );
    }

    /* ======================================
       CONTROL DE OPERACIONES
    ====================================== */

    async function ejecutar(operacion) {
        habilitar(false);

        try {
            await operacion();
        } catch (error) {
            console.error(error);

            estado("Error: " + error.message);

            alert(
                "No se completo la operacion: " +
                error.message +
                "\n\nNo borres tus datos originales."
            );
        } finally {
            habilitar(true);
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        elemento("btnExportarRespaldo").addEventListener(
            "click",
            () => ejecutar(exportar)
        );

        elemento("btnImportarRespaldo").addEventListener(
            "click",
            () => ejecutar(importar)
        );
    });

})();
