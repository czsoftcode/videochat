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
    // V src/Controller/TurnCredentialsController.php
    public function getTurnCredentials(Request $request): JsonResponse
    {
        try {
            // API klíč je bezpečně uložen na serveru
            $apiUrl = self::METERED_TURN_API_URL . '?apiKey=' . urlencode($this->meteredApiKey);

            $response = $this->httpClient->request('GET', $apiUrl, [
                'timeout' => 5,
                'headers' => [
                    'Accept' => 'application/json'
                ]
            ]);

            if ($response->getStatusCode() === 200) {
                $data = $response->toArray();
                return $this->json($data);
            }
        } catch (\Exception $e) {
            error_log('Chyba při získávání TURN credentials: ' . $e->getMessage());
        }

        return $this->getFallbackIceServers();
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
    // V metodě getMeteredTurnCredentials()
    private function getMeteredTurnCredentials(Request $request): JsonResponse
    {
        // Přímé přesměrování na Metered API
        try {
            // Použijeme URL pro Metered TURN API s vlastní subdoménou a API klíčem
            $apiUrl = self::METERED_TURN_API_URL . '?apiKey=' . urlencode($this->meteredApiKey);

            $response = $this->httpClient->request('GET', $apiUrl, [
                'timeout' => 5,
                'headers' => [
                    'Accept' => 'application/json',
                    'User-Agent' => 'VideoChat/1.0 (Symfony)'
                ]
            ]);

            // Pouze vracíme data z Metered API přímo klientovi
            if ($response->getStatusCode() === 200) {
                $data = $response->toArray();
                $jsonResponse = $this->json($data);

                // Nastavíme správné CORS a Cache hlavičky
                $jsonResponse->headers->set('Cache-Control', 'no-cache, no-store, must-revalidate');
                $jsonResponse->headers->set('Access-Control-Allow-Origin', '*');

                return $jsonResponse;
            }
        } catch (\Exception $e) {
            // V případě chyby použijeme záložní přístup
            error_log('Výjimka při získávání TURN credentials: ' . $e->getMessage());
        }

        return $this->getFallbackIceServers();
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