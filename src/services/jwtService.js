/**
 * jwtService · firma JWT propio cuando Google no entrega id_token
 * --------------------------------------------------------------
 * Google a veces no devuelve id_token en el flujo de refresh. En ese
 * caso firmamos uno propio con la información del usuario que ya
 * conocemos, mismo formato/claims que el original (email, sub, name…).
 * Vida útil: 1 h por defecto.
 */
const jwt = require('jsonwebtoken');
const config = require('../../config');

class JwtService {
  generateToken(userInfo) {
    if (!config.jwtSecret) {
      throw new Error('JWT_SECRET no configurado');
    }

    const expiresIn = config.jwtExpiresIn;

    const token = jwt.sign(
      {
        email: userInfo.email,
        sub: userInfo.sub,
        name: userInfo.name,
        picture: userInfo.picture,
        given_name: userInfo.given_name,
        family_name: userInfo.family_name,
        hd: userInfo.hd,
        email_verified: userInfo.email_verified,
        iss: 'hipotecai-login-service',
        aud: 'hipotecai',
      },
      config.jwtSecret,
      { expiresIn }
    );

    // Calcular expiresIn en segundos
    const decoded = jwt.decode(token);
    const expiresInSeconds = decoded.exp - decoded.iat;

    return { token, expiresIn: expiresInSeconds };
  }

  verifyToken(token) {
    if (!config.jwtSecret) throw new Error('JWT_SECRET no configurado');
    return jwt.verify(token, config.jwtSecret);
  }
}

module.exports = new JwtService();
