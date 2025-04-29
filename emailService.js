// emailService.js

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

export async function enviarCorreo(destinatario, asunto, contenidoHTML) {
  try {
    console.log("📧 Preparando envío de correo...");
    console.log("📍 Destinatario:", destinatario);
    console.log("📍 Asunto:", asunto);
    console.log("📍 Contenido HTML:", contenidoHTML);

    const info = await transporter.sendMail({
      from: `"Sistema de Aprobaciones" <${process.env.EMAIL_USER}>`,
      to: destinatario,
      subject: asunto,
      html: contenidoHTML
    });

    console.log("✅ Correo enviado:", info.response);
  } catch (error) {
    console.error("❌ Error al enviar correo:", error);
  }
}
