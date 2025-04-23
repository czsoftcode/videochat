<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Csrf\CsrfTokenManagerInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

class TurnCredentialsController extends AbstractController
{
    public function __construct(
        private string $meteredUsername,
        private string $meteredCredential,
        private CsrfTokenManagerInterface $csrfTokenManager
    ) {}

    #[Route('/api/turn-credentials', name: 'api_turn_credentials', methods: ['GET'])]
    public function getTurnCredentials(Request $request): JsonResponse
    {
        // Ověříme přístup pomocí několika metod
        $hasAccess = false;
        
        // 1. Kontrola referreru - povolíme přístup pouze z naší domény
        $referrer = $request->headers->get('referer');
        $host = $request->getHost();
        if ($referrer && str_contains($referrer, $host)) {
            $hasAccess = true;
        }
        
        // 2. Kontrola přihlášeného uživatele
        if ($this->getUser()) {
            $hasAccess = true;
        }
        
        // 3. Kontrola CSRF tokenu - bezpečnější než jen referrer
        $csrfToken = $request->query->get('csrf_token');
        if ($csrfToken && $this->isCsrfTokenValid('turn_credentials', $csrfToken)) {
            $hasAccess = true;
        }
        
        // 4. Kontrola auth tokenu předaného z JavaScript
        $authToken = $request->query->get('auth_token');
        if ($authToken) {
            // Token má formát "{user_id}_{csrf_token}" nebo "guest_{csrf_token}"
            $parts = explode('_', $authToken, 2);
            if (count($parts) === 2) {
                $userId = $parts[0];
                $token = $parts[1];
                
                if ($userId === 'guest') {
                    // Kontrola guest tokenu
                    if ($this->isCsrfTokenValid('guest_auth', $token)) {
                        $hasAccess = true;
                    }
                } else {
                    // Kontrola user tokenu
                    if ($this->isCsrfTokenValid('user_auth_' . $userId, $token)) {
                        $hasAccess = true;
                    }
                }
            }
        }
        
        // Pokud jsme určili, že klient má přístup
        if ($hasAccess) {
            // Vrátíme kompletní konfiguraci TURN serverů
            return $this->json([
                [
                    'urls' => 'stun:stun.relay.metered.ca:80',
                ],
                [
                    'urls' => 'turns:eu.relay.metered.ca:80',
                    'username' => $this->meteredUsername,
                    'credential' => $this->meteredCredential
                ],
                [
                    'urls' => 'turns:eu.relay.metered.ca:80?transport=tcp',
                    'username' => $this->meteredUsername,
                    'credential' => $this->meteredCredential
                ],
                [
                    'urls' => 'turns:eu.relay.metered.ca:443',
                    'username' => $this->meteredUsername,
                    'credential' => $this->meteredCredential
                ],
                [
                    'urls' => 'turns:eu.relay.metered.ca:443?transport=tcp',
                    'username' => $this->meteredUsername,
                    'credential' => $this->meteredCredential
                ],
                [
                    'urls' => 'stun:stun.l.google.com:19302'
                ]
            ]);
        }
        
        // Pro produkční použití - pokud kontrola přístupu selže,
        // vrátíme pouze STUN server bez TURN serverů
        return $this->json([
            [
                'urls' => 'stun:stun.l.google.com:19302'
            ]
        ]);
    }
}