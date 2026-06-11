# French Encryption Declaration — base-studio-code

> **Purpose.** This document is the *déclaration* of a means of cryptology supplied to the
> general public, required for distributing **base-studio-code** on the Apple App Store in
> France. Apple accepts it as an upload in App Store Connect → *App Information* →
> *App Encryption Documentation* (you do **not** need to email ANSSI separately).
>
> **Before use:** fill in the bracketed `[...]` fields (declarant address, date, signature),
> export to **PDF**, sign it, and upload it in App Store Connect. Keep the signed PDF; it is
> reused for future versions.
>
> ⚠️ *This draft reflects Apple's and ANSSI's published guidance. It is not legal advice.
> Have counsel review it before signing.*

---

## Version française

### Déclaration de fourniture d'un moyen de cryptologie

Conformément à l'article 30‑II de la loi n° 2004‑575 du 21 juin 2004 pour la confiance dans
l'économie numérique (LCEN) et au décret n° 2007‑663 du 2 mai 2007, le déclarant ci‑dessous
déclare la fourniture au public du moyen de cryptologie décrit ci‑après, assurant des
fonctions de confidentialité.

**Déclarant (fournisseur)**

| Champ | Valeur |
|---|---|
| Nom / raison sociale | Kevin Lago (personne physique) |
| Adresse | `[ADRESSE POSTALE]` |
| Pays | `[PAYS]` |
| Adresse électronique de contact | `[EMAIL DE CONTACT]` |
| Identifiant équipe Apple | A675QE2BV6 |

**Produit déclaré**

| Champ | Valeur |
|---|---|
| Nom commercial | base-studio-code |
| Identifiant (bundle ID) | com.mobilestudiocode.app |
| Type | Application mobile iOS |
| Catégorie | Grand public (« general public ») |
| Mode de distribution | Apple App Store |
| Description | Environnement de développement mobile assisté par IA. Comprend une fonction de tunnel chiffré de bout en bout permettant de relier l'application à un logiciel compagnon de bureau (base-studio-code) via un serveur relais. |

**Fonctions cryptographiques mises en œuvre**

1. **Tunnel chiffré de bout en bout** — Noise Protocol Framework, motif `Noise_IK_25519_ChaChaPoly_BLAKE2s` :
   - Échange de clés : **X25519** (Curve25519, ECDH), clés de 256 bits ;
   - Chiffrement symétrique authentifié : **ChaCha20‑Poly1305** (AEAD), clé de 256 bits ;
   - Fonction de hachage : **BLAKE2s** (256 bits) ;
   - Dérivation de clés : **HKDF** fondée sur HMAC‑BLAKE2s.
   - Objectif : confidentialité, intégrité et authentification du canal entre l'application et le poste de bureau de l'utilisateur.
2. **Sécurité du transport** : **TLS 1.2 / 1.3** (HTTPS et WSS) fourni par le système d'exploitation iOS, pour les échanges avec des interfaces de programmation tierces (Anthropic, GitHub, etc.) et avec le serveur relais.
3. **Stockage des secrets au repos** : trousseau iOS (« Keychain », via expo‑secure‑store), fourni par le système d'exploitation.

Tous les algorithmes employés sont des standards internationaux publiés (RFC 7748 pour X25519,
RFC 8439 pour ChaCha20‑Poly1305, RFC 7693 pour BLAKE2). **Aucun algorithme propriétaire ou non
standard** n'est utilisé. Le moyen de cryptologie est destiné au grand public et largement
diffusé via l'App Store.

**Déclaration**

Le déclarant atteste l'exactitude des informations ci‑dessus et déclare la fourniture du moyen
de cryptologie susmentionné au titre du régime de **déclaration** applicable aux moyens de
cryptologie grand public assurant des fonctions de confidentialité.

Fait à `[VILLE]`, le `[DATE]`.

Signature : `[SIGNATURE]`
Nom : Kevin Lago

---

## English version

### Declaration of supply of a means of cryptology

Pursuant to Article 30‑II of Law No. 2004‑575 of 21 June 2004 on confidence in the digital
economy (LCEN) and Decree No. 2007‑663 of 2 May 2007, the declarant below declares the supply
to the general public of the means of cryptology described hereafter, which provides
confidentiality functions.

**Declarant (supplier)**

| Field | Value |
|---|---|
| Name | Kevin Lago (individual) |
| Address | `[POSTAL ADDRESS]` |
| Country | `[COUNTRY]` |
| Contact email | `[CONTACT EMAIL]` |
| Apple Team ID | A675QE2BV6 |

**Product**

| Field | Value |
|---|---|
| Commercial name | base-studio-code |
| Bundle identifier | com.mobilestudiocode.app |
| Type | iOS mobile application |
| Category | General public (« grand public ») |
| Distribution | Apple App Store |
| Description | AI‑assisted mobile development environment. Includes an end‑to‑end encrypted tunnel feature that links the app to a desktop companion (base-studio-code) through a relay server. |

**Cryptographic functions implemented**

1. **End‑to‑end encrypted tunnel** — Noise Protocol Framework, pattern `Noise_IK_25519_ChaChaPoly_BLAKE2s`:
   - Key agreement: **X25519** (Curve25519 ECDH), 256‑bit keys;
   - Authenticated symmetric encryption: **ChaCha20‑Poly1305** (AEAD), 256‑bit key;
   - Hash function: **BLAKE2s** (256‑bit);
   - Key derivation: **HKDF** based on HMAC‑BLAKE2s.
   - Purpose: confidentiality, integrity and authentication of the channel between the app and the user's desktop.
2. **Transport security:** **TLS 1.2 / 1.3** (HTTPS and WSS) provided by the iOS operating system, for communication with third‑party APIs (Anthropic, GitHub, etc.) and the relay server.
3. **Secret storage at rest:** iOS Keychain (via expo‑secure‑store), provided by the operating system.

All algorithms used are published international standards (RFC 7748 for X25519, RFC 8439 for
ChaCha20‑Poly1305, RFC 7693 for BLAKE2). **No proprietary or non‑standard cryptography** is
used. The means of cryptology is intended for the general public and broadly distributed via
the App Store.

**Declaration**

The declarant certifies the accuracy of the information above and declares the supply of the
aforementioned means of cryptology under the **declaration** regime applicable to general‑public
means of cryptology that provide confidentiality functions.

Done at `[CITY]`, on `[DATE]`.

Signature: `[SIGNATURE]`
Name: Kevin Lago

---

## Reference — cryptography inventory (source of truth)

For maintainers: the declaration above is derived from the app's actual implementation.

| Use | Where | Algorithm(s) | Key length | Standard |
|---|---|---|---|---|
| E2E tunnel handshake | `src/lib/tunnel/noise.ts` | X25519 ECDH (Noise_IK) | 256‑bit | RFC 7748 |
| E2E tunnel transport | `src/lib/tunnel/noise.ts` | ChaCha20‑Poly1305 AEAD | 256‑bit | RFC 8439 |
| E2E tunnel hashing/KDF | `src/lib/tunnel/noise.ts` | BLAKE2s, HKDF (HMAC‑BLAKE2s) | 256‑bit | RFC 7693 / 5869 |
| API & relay transport | OS networking | TLS 1.2 / 1.3 | — | OS‑provided |
| Secret storage at rest | `src/lib/storage.ts` | iOS Keychain | — | OS‑provided |

If the cryptographic design changes (new algorithm, key length, or a proprietary scheme), update
this inventory **and** re‑issue the declaration, and revisit the U.S. self‑classification.
