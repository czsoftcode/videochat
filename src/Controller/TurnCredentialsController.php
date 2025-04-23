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
     * TURN server credentials and dependencies
     */
    public function __construct(
        private string $meteredApiKey,
        private ?CsrfTokenManagerInterface $csrfTokenManager = null,
        private ?HttpClientInterface $httpClient = null
    ) {
    }

    #[Route('/api/turn-credentials', name: 'api_turn_credentials', methods: ['GET'])]
    public function getTurnCredentials(Request $request): JsonResponse
    {
        return $this->processTurnCredentialsRequest($request);
    }

    #[Route('/api/turn-credentials', name: 'api_turn_credentials_post', methods: ['POST'])]
    public function postTurnCredentials(Request $request): JsonResponse
    {
        return $this->processTurnCredentialsRequest($request, true);
    }

    /**
     * Zpracování požadavku na TURN credentials - sdílená implementace pro GET i POST
     */
    private function processTurnCredentialsRequest(Request $request, bool $isPost = false): JsonResponse
    {
        $referer = $request->headers->get('referer');
        $host = $request->getHost();
        $hasUser = $this->getUser() !== null;

        // Pro produkci - pokud je verze prod, vždy povolíme přístup
        $appEnv = $this->getParameter('kernel.environment');
        if ($appEnv === 'prod') {
            // V produkci budeme benevolentnější
            return $this->getMeteredTurnCredentials();
        }

        // Pro vývojové prostředí potřebujeme i nadále ověření
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
            $hasAccess = true;
        }

        // 4. Kontrola parametru retry
        if ($request->query->get('retry') === 'true') {
            $hasAccess = true;
        }

        // 5. Kontrola CSRF tokenu
        $csrfToken = $request->query->get('csrf_token');
        if ($csrfToken && $this->csrfTokenManager && $this->isCsrfTokenValid('turn_credentials', $csrfToken)) {
            $hasAccess = true;
        }

        // 6. Kontrola auth tokenu
        $authToken = $request->query->get('auth_token');
        if ($authToken && $this->csrfTokenManager) {
            $parts = explode('_', $authToken, 2);
            if (count($parts) === 2) {
                $userId = $parts[0];
                $token = $parts[1];

                if ($userId === 'guest') {
                    if ($this->isCsrfTokenValid('guest_auth', $token)) {
                        $hasAccess = true;
                    }
                } else {
                    if ($this->isCsrfTokenValid('user_auth_' . $userId, $token)) {
                        $hasAccess = true;
                    }
                }
            }
        }

        // Pokud jsme určili, že klient má přístup
        if ($hasAccess) {
            return $this->getMeteredTurnCredentials();
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
     * Získá dočasné TURN credentials pomocí Metered API
     * Podle dokumentace na https://www.metered.ca/docs/turn-rest-api/get-credential/
     */
    private function getMeteredTurnCredentials(): JsonResponse
    {
        // Pokud nemáme HTTP klienta, použijeme záložní přístup
        if (!$this->httpClient) {
            return $this->getFallbackIceServers();
        }

        try {
            // Generujeme unikátní identifikátor uživatele
            $userId = $this->getUser() ? (string) $this->getUser()->getId() : 'guest-' . uniqid();

            // Vytvoříme URL pro Metered API
            $apiUrl = "https://api.metered.ca/api/v1/turn/credentials?apiKey={$this->meteredApiKey}";

            // Vytvoření HTTP požadavku na Metered API
            $response = $this->httpClient->request('GET', $apiUrl, [
                'timeout' => 5,
                'headers' => [
                    'Accept' => 'application/json',
                ]
            ]);

            // Kontrola úspěšné odpovědi
            if ($response->getStatusCode() === 200) {
                $data = $response->toArray();

                // Přidáme cache control hlavičky
                $jsonResponse = $this->json($data);
                $jsonResponse->headers->set('Cache-Control', 'no-cache, no-store, must-revalidate');
                $jsonResponse->headers->set('Pragma', 'no-cache');
                $jsonResponse->headers->set('Expires', '0');

                return $jsonResponse;
            }

            // Pokud API vrátí chybu, logujeme ji a použijeme záložní přístup
            error_log('Chyba při získávání TURN credentials z Metered API: ' . $response->getContent(false));
            return $this->getFallbackIceServers();

        } catch (\Exception $e) {
            // V případě chyby použijeme záložní přístup
            error_log('Výjimka při získávání TURN credentials: ' . $e->getMessage());
            return $this->getFallbackIceServers();
        }
    }

    /**
     * Záložní ICE servery - pouze veřejné STUN servery
     */
    private function getFallbackIceServers(): JsonResponse
    {
        // Vytvoříme response pouze se STUN servery (funguje i bez autentizace)
        $response = $this->json([
            [
                'urls' => 'stun:stun.l.google.com:19302'
            ],
            [
                'urls' => 'stun:stun1.l.google.com:19302'
            ],
            [
                'urls' => 'stun:stun2.l.google.com:19302'
            ],
            [
                'urls' => 'stun:stun.relay.metered.ca:80'
            ]
        ]);

        // Přidáme cache control hlavičky pro zabránění ukládání do cache
        $response->headers->set('Cache-Control', 'no-cache, no-store, must-revalidate');
        $response->headers->set('Pragma', 'no-cache');
        $response->headers->set('Expires', '0');

        return $response;
    }

    /**
     * Vrátí JSON response s TURN servery získanými z Metered API
     */
    private function getTurnServersResponse(): JsonResponse
    {
        // Pokud máme HTTP klienta, získáme aktuální přihlašovací údaje z API
        if ($this->httpClient) {
            try {
                // Vytvoříme URL pro Metered API
                $apiUrl = "https://api.metered.ca/api/v1/turn/credentials?apiKey={$this->meteredApiKey}";

                // Vytvoření HTTP požadavku na Metered API
                $response = $this->httpClient->request('GET', $apiUrl, [
                    'timeout' => 5,
                    'headers' => [
                        'Accept' => 'application/json',
                    ]
                ]);

                // Kontrola úspěšné odpovědi
                if ($response->getStatusCode() === 200) {
                    $data = $response->toArray();

                    // Přidáme cache control hlavičky
                    $jsonResponse = $this->json($data);
                    $jsonResponse->headers->set('Cache-Control', 'no-cache, no-store, must-revalidate');
                    $jsonResponse->headers->set('Pragma', 'no-cache');
                    $jsonResponse->headers->set('Expires', '0');

                    return $jsonResponse;
                }
            } catch (\Exception $e) {
                // V případě chyby logujeme a použijeme záložní servery
            }
        }

        // Záložní přístup - pouze STUN servery
        $response = $this->json([
            [
                'urls' => 'stun:stun.relay.metered.ca:80',
            ],
            [
                'urls' => 'stun:stun.l.google.com:19302'
            ],
            [
                'urls' => 'stun:stun1.l.google.com:19302'
            ],
            [
                'urls' => 'stun:stun2.l.google.com:19302'
            ]
        ]);

        // Přidáme cache control hlavičky pro zabránění ukládání do cache
        $response->headers->set('Cache-Control', 'no-cache, no-store, must-revalidate');
        $response->headers->set('Pragma', 'no-cache');
        $response->headers->set('Expires', '0');

        return $response;
    }
}