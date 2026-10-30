# Phone preview

The deployed app is at https://hieu-sreviews.vercel.app. Existing Vercel sign-in protection applies on phones. See [mobile release verification](mobile-release-verification.md) for the completed Chrome emulation checks and physical-device limits.

To test local changes on a phone connected to the same Wi-Fi as this computer, find the computer's active Wi-Fi/Ethernet IPv4 address with `ipconfig`, then start the development server using that address. Replace the example IP below:

```sh
npm run dev -- --hostname 192.168.1.20
```

Open `http://<computer-LAN-IPv4>:3000` on the phone. `localhost` on the phone refers to the phone itself. Starting with the actual LAN hostname lets Next.js validate development asset requests without adding broad allowed origins. Local reachability depends on the network allowing connections between devices and the computer's existing firewall rules.

Use the development server for this HTTP preview; production profile cookies require HTTPS. Keep local environment files out of Git. No firewall or production access changes are needed for the completed release.

For physical-device acceptance, check portrait and landscape, profile selection, search, rating input, date selection, spending, form controls, and analytics filtering with an active search. Open the software keyboard and confirm the focused field and final form actions remain reachable. Verify that browser zoom works and bottom navigation does not prevent scrolling to content.
