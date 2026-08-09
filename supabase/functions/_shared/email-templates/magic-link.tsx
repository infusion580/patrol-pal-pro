/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

import {
  brandBar,
  brandName,
  brandTagline,
  button,
  container,
  footer,
  h1,
  hr,
  linkFallback,
  main,
  text,
} from './styles.ts'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Tu enlace de acceso a {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandBar} />
        <Text style={brandName}>Defender</Text>
        <Text style={brandTagline}>Seguridad Privada</Text>

        <Heading style={h1}>Tu enlace de acceso</Heading>
        <Text style={text}>
          Usa el siguiente botón para iniciar sesión en {siteName}. El enlace es
          personal, de un solo uso y caduca en poco tiempo.
        </Text>

        <Button style={button} href={confirmationUrl}>
          Iniciar sesión
        </Button>

        <Text style={linkFallback}>
          Si el botón no funciona, copia y pega esta dirección en tu navegador:
          <br />
          {confirmationUrl}
        </Text>

        <Hr style={hr} />
        <Text style={footer}>
          Si tú no solicitaste este acceso, ignora este mensaje.
        </Text>
        <Text style={footer}>
          Este es un correo automático de {siteName}. No respondas a este
          mensaje.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail
