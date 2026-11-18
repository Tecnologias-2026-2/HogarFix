import { auth, db } from "./firebase-config.js";

import {
    createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

import {
    doc,
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

async function probarFirebase() {

    try {

        // Crear un usuario de prueba
        const credencial = await createUserWithEmailAndPassword(
            auth,
            "prueba.hogarfix@gmail.com",
            "PruebaHogarFix2026!"
        );

        const uid = credencial.user.uid;

        // Guardar información en Firestore
        await setDoc(doc(db, "pruebas", uid), {
            mensaje: "HogarFix conectado correctamente",
            usuario: "Prueba",
            fecha: new Date()
        });

        // Consultar la información guardada
        const resultado = await getDoc(doc(db, "pruebas", uid));

        if (resultado.exists()) {
            console.log("¡Firebase funciona correctamente!");
            console.log(resultado.data());
        }

    } catch (error) {

        console.error("Error en Firebase:", error.code, error.message);

    }
}

probarFirebase();
