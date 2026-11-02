
/* ==========================================
   MI GALERIA - BASE DE DATOS
   Archivo: database.js
========================================== */

const DB_NOMBRE = "MiGaleriaDB";
const DB_VERSION = 1;

let db = null;

const $ = id => document.getElementById(id);

function crearId() {
    return crypto.randomUUID();
}

/* INICIAR INDEXEDDB */

function iniciarDB() {
    return new Promise((resolve, reject) => {

        const solicitud = indexedDB.open(
            DB_NOMBRE,
            DB_VERSION
        );

        solicitud.onupgradeneeded = evento => {
            const base = evento.target.result;

            if (!base.objectStoreNames.contains("carpetas")) {
                base.createObjectStore("carpetas", {
                    keyPath: "id"
                });
            }

            if (!base.objectStoreNames.contains("archivos")) {
                base.createObjectStore("archivos", {
                    keyPath: "id"
                });
            }
        };

        solicitud.onsuccess = () => {
            db = solicitud.result;

            db.onversionchange = () => {
                db.close();
                alert(
                    "La base de datos cambió. Actualiza la página."
                );
            };

            resolve();
        };

        solicitud.onerror = () => {
            reject(solicitud.error);
        };

        solicitud.onblocked = () => {
            console.warn(
                "Cierra otras pestañas de Mi Galería."
            );
        };
    });
}

/* GUARDAR O ACTUALIZAR */

function guardar(almacen, objeto) {
    return new Promise((resolve, reject) => {

        const tx = db.transaction(
            almacen,
            "readwrite"
        );

        tx.objectStore(almacen).put(objeto);

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

/* OBTENER TODOS LOS REGISTROS */

function obtenerTodos(almacen) {
    return new Promise((resolve, reject) => {

        const tx = db.transaction(
            almacen,
            "readonly"
        );

        const solicitud = tx
            .objectStore(almacen)
            .getAll();

        solicitud.onsuccess = () => {
            resolve(solicitud.result);
        };

        solicitud.onerror = () => {
            reject(solicitud.error);
        };
    });
}

/* ELIMINAR UN REGISTRO */

function eliminar(almacen, id) {
    return new Promise((resolve, reject) => {

        const tx = db.transaction(
            almacen,
            "readwrite"
        );

        tx.objectStore(almacen).delete(id);

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

/* OPERACIONES EN UNA SOLA TRANSACCION */

function ejecutarTransaccion(almacenes, operaciones) {
    return new Promise((resolve, reject) => {

        const tx = db.transaction(
            almacenes,
            "readwrite"
        );

        operaciones(tx);

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

/* MOSTRAR ERRORES */

function mostrarError(error) {
    console.error("Error de Mi Galería:", error);

    alert(
        "Ocurrió un error al procesar la operación. " +
        "Revisa la consola del navegador y el espacio disponible."
    );
}
