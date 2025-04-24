// emailService.js
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'movimientospersonal.noreply@gmail.com',
      pass: 'tubi ajdt grjl akpz'
    }
  });

  export async function enviarCorreo(destinatario, asunto, contenidoHTML) {
    try {
      console.log("📧 Preparando envío de correo...");
      console.log("📍 Destinatario:", destinatario);
      console.log("📍 Asunto:", asunto);
      console.log("📍 Contenido HTML:", contenidoHTML);
  
      const info = await transporter.sendMail({
        from: '"Sistema de Aprobaciones" <movimientospersonal.noreply@gmail.com>',
        to: destinatario,
        subject: asunto,
        html: contenidoHTML
      });
  
      console.log("✅ Correo enviado:", info.response);
    } catch (error) {
      console.error("❌ Error al enviar correo:", error);
    }
  }
