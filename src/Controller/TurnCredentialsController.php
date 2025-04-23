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
    /**
     * TURN server credentials and CSRF token manager
     */
    public function __construct(
        private string $meteredUsername,
        private string $meteredCredential,
        private ?CsrfTokenManagerInterface $csrfTokenManager = null
    ) {
        // Pokud csrfTokenManager není poskytnut, nastavíme jej na null
        // To umožní službě fungovat i když CSRF není k dispozici
    }

    #[Route('/api/turn-credentials', name: 'api_turn_credentials', methods: ['GET'])]
    public function getTurnCredentials(Request $request): JsonResponse
    {
        return $this->processTurnCredentialsRequest($request);
    }
    
    #[Route('/api/turn-credentials', name: 'api_turn_credentials_post', methods: ['POST'])]
    public function postTurnCredentials(Request $request): JsonResponse
    {
        // Jelikož toto je POST metoda, spoléháme na jiné parametry
        return $this->processTurnCredentialsRequest($request, true);
    }
    
    /**
     * Zpracování požadavku na TURN credentials - sdílená implementace pro GET i POST
     */
    private function processTurnCredentialsRequest(Request $request, bool $isPost = false): JsonResponse
    {
        // Přidáme logování pro odhalení problémů
        $method = $request->getMethod();
        $referer = $request->headers->get('referer');
        $host = $request->getHost();
        $hasUser = $this->getUser() !== null;
        
        // Pro produkci - pokud je verze prod, vždy povolíme přístup
        $appEnv = $this->getParameter('kernel.environment');
        if ($appEnv === 'prod') {
            // V produkci budeme benevolentnější, abychom minimalizovali problémy
            // STUN/TURN servery nejsou citlivá data, tak můžeme být méně striktní
            
            // Vrátíme kompletní konfiguraci TURN serverů
            return $this->getTurnServersResponse();
        }
        
        // Pro vývojové prostředí potřebujeme i nadále ověření
        // Ověříme přístup pomocí několika metod
        $hasAccess = false;
        
        // 1. Kontrola referreru - povolíme přístup pouze z naší domény
        if ($referer && str_contains($referer, $host)) {
            $hasAccess = true;
        }
        
        // 2. Kontrola přihlášeného uživatele
        if ($hasUser) {
            $hasAccess = true;
        }
        
        // 3. Pro POST požadavky
        if ($isPost) {
            // Povolíme přístup pro POST požadavky
            $hasAccess = true;
        }
        
        // 4. Kontrola parametru retry - pokud jde o opakovaný pokus z JavaScript
        if ($request->query->get('retry') === 'true') {
            $hasAccess = true;
        }
        
        // 5. Kontrola CSRF tokenu - bezpečnější než jen referrer
        $csrfToken = $request->query->get('csrf_token');
        if ($csrfToken && $this->isCsrfTokenValid('turn_credentials', $csrfToken)) {
            $hasAccess = true;
        }
        
        // 6. Kontrola auth tokenu předaného z JavaScript
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
            return $this->getTurnServersResponse();
        }
        
        // Pro produkční použití - pokud kontrola přístupu selže,
        // vrátíme pouze STUN server bez TURN serverů
        return $this->json([
            [
                'urls' => 'stun:stun.l.google.com:19302'
            ]
        ]);
    }
    
    /**
     * Vrátí JSON response s TURN servery
     */
    private function getTurnServersResponse(): JsonResponse
    {
        // Vytvoříme response s cache-control hlavičkami
        $response = $this->json([
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
        
        // Přidáme cache control hlavičky pro zabránění ukládání do cache
        $response->headers->set('Cache-Control', 'no-cache, no-store, must-revalidate');
        $response->headers->set('Pragma', 'no-cache');
        $response->headers->set('Expires', '0');
        
        return $response;
    }
}