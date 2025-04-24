<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\DependencyInjection\ParameterBag\ParameterBagInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Csrf\CsrfTokenManagerInterface;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Symfony\Contracts\HttpClient\HttpClientInterface;

class TurnCredentialsController extends AbstractController
{
    private $turnServer;
    private $turnUsername;
    private $turnPassword;

    public function __construct(ParameterBagInterface $params) {
        $this->turnServer = $params->get('app.express_turn.server');
        $this->turnUsername = $params->get('app.express_turn.username');
        $this->turnPassword = $params->get('app.express_turn.password');
    }

    #[Route('/api/turn-credentials', name: 'api_turn_credentials', methods: ['GET', 'POST'])]
    #[IsGranted('IS_AUTHENTICATED_REMEMBERED')]
    public function getTurnCredentials(Request $request): JsonResponse
    {
        $referer = $request->headers->get('Referer');
        $host = $request->getHost();
        if (!$referer || !str_contains($referer, $host)) {
            return $this->json(['error' => 'Unauthorized'], 403);
        }
        // Generujeme dočasný credential s expiračním časem (volitelné)
        // Toto zvyšuje bezpečnost v produkčním prostředí
        $timestamp = time() + 3600; // Platnost 1 hodina
        $temporaryUsername = $timestamp . ":" . $this->turnUsername;

        // ICE servery včetně TURN
        $iceServers = [
            [
                'urls' => 'stun:stun.l.google.com:19302'
            ],
            [
                'urls' => $this->turnServer,
                'username' => $temporaryUsername,
                'credential' => $this->turnPassword,
                'credentialType' => 'password'
            ]
        ];

        // Přidání HTTPS/TLS varianty, pokud existuje
        if (strpos($this->turnServer, 'turn:') === 0) {
            $secureUrl = str_replace('turn:', 'turns:', $this->turnServer);
            $iceServers[] = [
                'urls' => $secureUrl,
                'username' => $temporaryUsername,
                'credential' => $this->turnPassword,
                'credentialType' => 'password'
            ];
        }

        $response = $this->json($iceServers);

        // Přidání cache control hlaviček
        $response->headers->set('Cache-Control', 'no-cache, no-store, must-revalidate');
        $response->headers->set('Pragma', 'no-cache');
        $response->headers->set('Expires', '0');

        return $response;
    }
}