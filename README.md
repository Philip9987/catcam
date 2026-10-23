# CatCam

CatCam is a mobile-first web app for viewing a live camera feed from another device.

## Try locally

1. Install Node.js 22 or later.
2. Run `npm install`.
3. Run `npm run dev`. This starts the local Node API and Vite development server together; Vite proxies admin, signaling, and ICE requests to that same API.
4. Open the Vite URL on the camera device, start the camera, and copy the pairing code.
5. Open the **same URL** on the viewer device and enter the code.

`localhost` is only reachable on the computer running the server. A phone cannot use the computer's `localhost` address. To test on a phone, expose the app through an HTTPS development tunnel (for example, a Codespaces forwarded port). Keep the development server running and use its public HTTPS URL on both devices.

## Make it usable from anywhere

The camera and viewer both need to reach the same public CatCam address. Deploy CatCam as a **single Node.js web service** on a host that supports long-lived WebSocket connections and HTTPS (for example, a paid always-on Render, Railway, or Fly.io service).

1. Push this repository to GitHub and create a Node web service from it on your hosting provider.
2. Set the build command to `npm ci && npm run build` and the start command to `npm start`. The service listens on the host-provided `PORT` and serves both the web app and its signaling endpoint.
3. Use one service instance: pairing rooms are temporary and held in that instance's memory.
4. Set `APP_ORIGIN` to the public HTTPS origin, for example `https://catcam.example.com`. If the host is behind a trusted reverse proxy that sets `x-forwarded-for`, set `TRUST_PROXY=true`.
5. Open the resulting HTTPS address on both devices. On the camera device, keep the CatCam page open, allow camera access, start the camera, and share its short-lived code with your viewer device.

The app uses WebRTC: video is encrypted between devices and usually travels directly between them. The hosted server handles pairing and connection setup, not video recording or storage.

### cPanel / Passenger under a subpath

CatCam can be built and served under a URL prefix such as `/catcam/`:

1. Set `VITE_BASE_PATH=/catcam/` for the production build and `APP_BASE_PATH=/catcam` in the Node app environment. Leave `VITE_SIGNALING_URL` unset when the app and signaling server share this deployment.
2. Configure the cPanel Node.js application with Node.js 22, a private application root outside the public webroot, `/catcam` as its application URL, `app.js` as its startup file, and `npm ci` as its dependency installation command. The included `.npmrc` makes sure build tools are installed even when the host sets `NODE_ENV=production`. The `npm start` script uses the Passenger-provided `PORT`.
3. The HTTP signaling endpoint is `/catcam/ice-servers` and the WebSocket endpoint is `/catcam/signal`. Configure the web server/Passenger WebSocket proxy to forward WebSocket upgrades for `/catcam/signal` to this same Node app. The route inside the app is `/signal` when Passenger strips the mount point, and the app also accepts `/catcam/signal`.
4. Set `APP_ORIGIN=https://philip.smartsource.dev`. Do not set `PORT` yourself. Configure TURN variables only if a TURN service is available.
5. Run `npm run build` with `VITE_BASE_PATH=/catcam/`, then restart the Passenger application after installing dependencies and setting its environment variables.

### More reliable connections with TURN

STUN can establish direct connections on many networks, but some mobile carriers, office Wi-Fi, and restrictive routers block them. For reliable cross-network access, obtain a TURN relay service (or operate Coturn) and set these server environment variables in the hosting dashboard:

- `TURN_URLS`: one or more `turn:` or `turns:` URLs, comma-separated.
- `TURN_SHARED_SECRET`: the TURN service's REST/shared secret. Keep it only on the server; never use it as a frontend variable.
- `TURN_TTL_SECONDS`: optional credential lifetime, default 3600 seconds.

CatCam creates short-lived TURN credentials on `/ice-servers`; the shared secret is never sent to the browser. Without a configured TURN service, the app still attempts direct WebRTC and tells the viewer that TURN may be needed if a connection fails. TURN relays may add service and bandwidth costs.

For local server configuration, copy `.env.example` to `.env` and fill in the optional values. Never commit `.env`.

### Administer public livestreams

The admin panel can stop active **public** streams. It does not list or provide video access to private streams. Its hidden entry gesture is only a convenience, not an access control: while the local display name is exactly `admin` or `Admin`, click the CatCam logo seven times within 15 seconds, then click the footer within the next 15 seconds. This opens the sign-in form; server authentication is required before any moderation action.

For a local test, run `npm run dev` and open the Vite URL, usually `http://localhost:5173`. The hidden admin entry opens a dedicated `/admin` page. If no admin password is configured yet, it offers a one-time password setup. Choose a unique password of 16–128 characters. This initial setup is accepted only from a loopback connection using a matching `localhost`, `127.0.0.1`, or `::1` browser origin, and only while no password is configured. The default username is `Philip`; set `ADMIN_USERNAME` in the server environment to use a different one.

For a hosted deployment, set both `ADMIN_USERNAME` and `ADMIN_PASSWORD` in the server environment before the first admin login; remote users cannot use the local setup flow. Do not reuse a password shared in chat or commit it to the repository. After signing in, you can change the password from the admin panel. The server stores only a salted scrypt hash in `.admin-credentials.json` (ignored by Git) and revokes admin sessions after a password change. Keep the private app directory writable and persistent, or configure `ADMIN_CREDENTIALS_FILE` to a persistent path outside the public webroot. Admin sessions use an HttpOnly, SameSite=Strict cookie and expire after four hours. Failed login attempts are rate-limited, and successful logins, failures, password changes, and public-stream stops are written to the Node server log. Configure server-log retention appropriately for your host.

## What is implemented

- Camera preview and explicit browser permission.
- Private streams use an eight-character, randomly generated pairing code and allow up to six simultaneous viewers. The camera can instead start a public stream, listed only while live and available to multiple simultaneous viewers without a code.
- Public streams are shown by default when the app opens and are visible to anyone who opens the public-streams tab. Their share link opens the selected live stream directly; do not show private or sensitive content on a public stream. It ends and disappears from the directory when the camera disconnects.
- A visitor can save an optional display name in the browser. It is shown as the camera owner's name in the public directory and alongside comments; names are not verified because the prototype has no accounts.
- Strong profanity in display names is rejected and in comments is censored; mild swear words such as "skit" and "fan" are allowed. After three comments containing blocked strong profanity, a viewer is automatically banned from that live. The count survives reconnects from the same browser, and the ban lasts for that live. Stream owners can also mute, kick, or ban connected viewers. Because there are no accounts, clearing site data or switching devices bypasses that identity.
- The home page shows a random Swedish cat fact and avoids repeating the previous fact on the next page load.
- Viewers can save public streamers as favorites in this browser; favorite names remain listed while offline and match future streams using the same display name.
- With browser permission, viewers can enable notifications for favorited public streamers. CatCam must remain open to monitor livestreams; notifications appear when a favorited streamer starts a new public session.
- Camera controls to pause/resume the live video without ending the session, toggle only the camera video feed while keeping the private livestream running, or stop streaming and release the camera.
- WebRTC video with temporary WebSocket signaling.
- Private pairing codes expire after ten minutes if unused; an active viewing session remains open until a device disconnects.
- Viewer code attempts are rate-limited. The streamer controls whether microphone audio is sent, and viewers choose whether to play it. Audio and video are not recorded.
- Private streams include an optional Cozy Board Game lobby where viewers can join from an in-chat invite before the camera starts the round. The server is authoritative for turns, dice rolls, property economy, and special actions (arena and bus route events), and can add bots when the camera starts alone.
- Responsive warm-neutral and forest-green interface, with a wider two-column home layout and expanded stream directory on desktop.
- Server-authenticated admin panel for stopping public livestreams; no private-stream video access.

## Limitations

- This prototype has no user accounts or persistent camera ownership. A pairing code is a temporary bearer secret; only share it with someone you trust.
- The in-memory pairing service is intended for one server instance, not a horizontally scaled production system.
- iOS and other mobile browsers may stop camera capture when the tab is backgrounded or the screen is locked. Keep the camera page open and the phone powered.
- Before a public launch, add account-based access, stronger operational monitoring, and a review of privacy and data-retention requirements.

## Language and appearance

The interface supports Swedish (default), Danish, English, German, and Spanish. Use the language menu and theme button in the header to change language and switch between light and dark mode. Both choices are saved in the browser on that device.
