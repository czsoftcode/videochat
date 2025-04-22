<?php

namespace App\Controller;

use App\Entity\Room;
use App\Entity\User;
use App\Repository\RoomRepository;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;
use Symfony\Component\Security\Http\Attribute\IsGranted;

class InvitationController extends AbstractController
{
    private $entityManager;
    private $roomRepository;
    private $userRepository;

    public function __construct(
        EntityManagerInterface $entityManager,
        RoomRepository $roomRepository,
        UserRepository $userRepository
    ) {
        $this->entityManager = $entityManager;
        $this->roomRepository = $roomRepository;
        $this->userRepository = $userRepository;
    }

    #[Route('/room/{slug}/invite', name: 'app_room_invite', methods: ['GET', 'POST'])]
    #[IsGranted('ROLE_USER')]
    public function inviteToRoom(Request $request, string $slug): Response
    {
        $room = $this->roomRepository->findOneBy(['slug' => $slug]);
        
        if (!$room) {
            throw $this->createNotFoundException('Room not found');
        }
        
        // Verify the current user is the owner or a participant
        if ($room->getOwner() !== $this->getUser() && !$room->getParticipants()->contains($this->getUser())) {
            $this->addFlash('error', 'You do not have permission to invite others to this room');
            return $this->redirectToRoute('app_home');
        }
        
        $success = null;
        $error = null;
        
        if ($request->isMethod('POST')) {
            $email = $request->request->get('email');
            
            if (!$email) {
                $error = 'Please provide an email address';
            } else {
                $user = $this->userRepository->findOneBy(['email' => $email]);
                
                if (!$user) {
                    $error = 'User with this email does not exist';
                } elseif ($room->getParticipants()->contains($user)) {
                    $error = 'This user is already a participant in the room';
                } else {
                    // Generate invite URL with room details
                    $inviteUrl = $this->generateUrl('app_room_join', [
                        'slug' => $room->getSlug()
                    ], UrlGeneratorInterface::ABSOLUTE_URL);
                    
                    // In a real application, you would send an email here
                    // For demonstration, we'll just add the user to the room
                    $room->addParticipant($user);
                    $this->entityManager->flush();
                    
                    $success = sprintf(
                        'User %s has been added to the room. They can access it at: %s',
                        $user->getUsername(),
                        $inviteUrl
                    );
                }
            }
        }
        
        // Generate a shareable link with room information
        $shareableLink = $this->generateUrl('app_room_join', [
            'slug' => $room->getSlug()
        ], UrlGeneratorInterface::ABSOLUTE_URL);
        
        return $this->render('room/invite.html.twig', [
            'room' => $room,
            'shareableLink' => $shareableLink,
            'success' => $success,
            'error' => $error
        ]);
    }

    #[Route('/room/{slug}/participants', name: 'app_room_participants', methods: ['GET'])]
    #[IsGranted('ROLE_USER')]
    public function showParticipants(string $slug): Response
    {
        $room = $this->roomRepository->findOneBy(['slug' => $slug]);
        
        if (!$room) {
            throw $this->createNotFoundException('Room not found');
        }
        
        // Verify the current user is the owner or a participant
        if ($room->getOwner() !== $this->getUser() && !$room->getParticipants()->contains($this->getUser())) {
            $this->addFlash('error', 'You do not have permission to view participants of this room');
            return $this->redirectToRoute('app_home');
        }
        
        return $this->render('room/participants.html.twig', [
            'room' => $room
        ]);
    }

    #[Route('/room/{slug}/remove-participant/{id}', name: 'app_room_remove_participant', methods: ['POST'])]
    #[IsGranted('ROLE_USER')]
    public function removeParticipant(Request $request, string $slug, int $id): Response
    {
        $room = $this->roomRepository->findOneBy(['slug' => $slug]);
        
        if (!$room) {
            throw $this->createNotFoundException('Room not found');
        }
        
        // Only the room owner can remove participants
        if ($room->getOwner() !== $this->getUser()) {
            $this->addFlash('error', 'Only the room owner can remove participants');
            return $this->redirectToRoute('app_room_participants', ['slug' => $slug]);
        }
        
        $user = $this->userRepository->find($id);
        
        if (!$user) {
            throw $this->createNotFoundException('User not found');
        }
        
        // Cannot remove the owner
        if ($user === $room->getOwner()) {
            $this->addFlash('error', 'Cannot remove the room owner');
            return $this->redirectToRoute('app_room_participants', ['slug' => $slug]);
        }
        
        $room->removeParticipant($user);
        $this->entityManager->flush();
        
        $this->addFlash('success', sprintf('User %s has been removed from the room', $user->getUsername()));
        
        return $this->redirectToRoute('app_room_participants', ['slug' => $slug]);
    }
}