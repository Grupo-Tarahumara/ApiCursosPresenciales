import { enviarCorreo } from './emailService.js';

const html = `
<div style="font-family: sans-serif; padding: 24px;">
        <h2>Confirmación de cuenta</h2>
        <p>Hola <strong>JUAN FRANCISCO CASTELLANOS CABANILLAS</strong>,</p>
        <p>Haz clic en el siguiente enlace para activar tu cuenta:</p>
        <a href="https://tusitio.com/confirmar-cuenta?token=ffcdf897e33c21bd13ffcecc53f19172d56e536e34190d0bf30ac38424fc65a4" style="display:inline-block; background:#007bff; color:white; padding:10px 20px; border-radius:6px; text-decoration:none;">Activar cuenta</a>
        <p>Este enlace expirará en 24 horas.</p>
      </div>
`;

enviarCorreo('juan.castellanos@grupotarahumara.com.mx', 'Confirma tu cuenta', html);
