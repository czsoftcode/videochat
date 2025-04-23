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
     * Základní URL pro Metered TURN API s vlastní subdoménou
     */
    private const METERED_TURN_API_URL = 'https://softcode.metered.live/api/v1/turn/credentials';

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
        // Zjednodušený přístup - vrátíme přímo výsledek z Metered API
        return $this->getMeteredTurnCredentials($request);
    }

    #[Route('/api/turn-credentials', name: 'api_turn_credentials_post', methods: ['POST'])]
    public function postTurnCredentials(Request $request): JsonResponse
    {
        // Stejná implementace pro POST i GET
        return $this->getMeteredTurnCredentials($request);
    }

    /**
     * Získá dočasné TURN credentials pomocí Metered API
     */
    private function getMeteredTurnCredentials(Request $request): JsonResponse
    {
        // Logování pro diagnostiku
        error_log('Začínám získávat TURN credentials');
        error_log('API klíč nastaven: ' . (!empty($this->meteredApiKey) && $this->meteredApiKey !== 'metered_api_key' ? 'ANO' : 'NE'));

        // Pokud nemáme HTTP klienta nebo API klíč, použijeme záložní přístup
        if (!$this->httpClient || empty($this->meteredApiKey) || $this->meteredApiKey === 'metered_api_key') {
            error_log('Chybí HTTP klient nebo API klíč, používám záložní servery');
            return $this->getFallbackIceServers();
        }

        try {
            // Generujeme identifikátor uživatele - může být užitečné pro logování
            $userId = $this->getUser() ? (string) $this->getUser()->getId() : 'guest-' . uniqid();

            // Použijeme URL pro Metered TURN API s vlastní subdoménou a API klíčem
            $apiUrl = self::METERED_TURN_API_URL . '?apiKey=' . urlencode($this->meteredApiKey);

            // Zalogujeme volání pro diagnostiku (skryjeme API klíč v logu)
            $safeUrl = self::METERED_TURN_API_URL . '?apiKey=***********';
            error_log('Volám Metered TURN API: ' . $safeUrl . ' (user: ' . $userId . ')');

            // Vytvoření HTTP požadavku na Metered API
            $response = $this->httpClient->request('GET', $apiUrl, [
                'timeout' => 5,
                'headers' => [
                    'Accept' => 'application/json',
                    'User-Agent' => 'VideoChat/1.0 (Symfony)'
                ]
            ]);

            // Kontrola úspěšné odpovědi
            if ($response->getStatusCode() === 200) {
                $data = $response->toArray();

                // Zalogujeme část odpovědi pro ověření
                error_log('Úspěšná odpověď od Metered API: ' . substr(json_encode($data), 0, 100) . '...');

                // Přidáme cache control hlavičky
                $jsonResponse = $this->json($data);
                $jsonResponse->headers->set('Cache-Control', 'no-cache, no-store, must-revalidate');
                $jsonResponse->headers->set('Pragma', 'no-cache');
                $jsonResponse->headers->set('Expires', '0');

                // Přidáme CORS hlavičky pro zabránění problémům s různými doménami
                $jsonResponse->headers->set('Access-Control-Allow-Origin', '*');
                $jsonResponse->headers->set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
                $jsonResponse->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

                return $jsonResponse;
            }

            // Pokud API vrátí chybu, logujeme ji a použijeme záložní přístup
            error_log('Chyba při získávání TURN credentials z Metered API: ' . $response->getStatusCode() . ' - ' . $response->getContent(false));
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

        // Přidáme CORS hlavičky pro zabránění problémům s různými doménami
        $response->headers->set('Access-Control-Allow-Origin', '*');
        $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        return $response;
    }
}