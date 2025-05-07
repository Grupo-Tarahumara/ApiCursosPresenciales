// emailService.js

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,        
  port: Number(process.env.SMTP_PORT),
  auth: {
    user: process.env.SMTP_USER,      
    pass: process.env.SMTP_PASS      
  }
});

export async function enviarCorreo(destinatario, asunto, contenidoHTML) {
  try {
    console.log("📧 Preparando envío de correo...");
    console.log("📍 Destinatario:", destinatario);
    console.log("📍 Asunto:", asunto);
    console.log("📍 Contenido HTML:", contenidoHTML);

    const info = await transporter.sendMail({
      from: `"Sistema de Aprobaciones" <${process.env.SMTP_USER}>`,
      to: destinatario,
      subject: asunto,
      html: contenidoHTML
    });

    console.log("✅ Correo enviado:", info.response);
  } catch (error) {
    console.error("❌ Error al enviar correo:", error);
  }
}
