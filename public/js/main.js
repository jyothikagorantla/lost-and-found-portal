/**
 * Lost & Found Portal - Frontend JavaScript
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Bootstrap form validation
  const forms = document.querySelectorAll('.needs-validation');
  Array.from(forms).forEach((form) => {
    form.addEventListener(
      'submit',
      (event) => {
        if (!form.checkValidity()) {
          event.preventDefault();
          event.stopPropagation();
        }
        form.classList.add('was-validated');
      },
      false
    );
  });

  // 2. Client-side password matching check on registration
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  if (passwordInput && confirmPasswordInput) {
    const validatePasswords = () => {
      if (confirmPasswordInput.value && passwordInput.value !== confirmPasswordInput.value) {
        confirmPasswordInput.setCustomValidity('Passwords do not match');
      } else {
        confirmPasswordInput.setCustomValidity('');
      }
    };
    passwordInput.addEventListener('input', validatePasswords);
    confirmPasswordInput.addEventListener('input', validatePasswords);
  }

  // 3. Auto-dismiss alerts after 6 seconds
  const autoAlerts = document.querySelectorAll('.alert-dismissible');
  autoAlerts.forEach((alert) => {
    setTimeout(() => {
      const bsAlert = bootstrap.Alert.getOrCreateInstance(alert);
      if (bsAlert) {
        bsAlert.close();
      }
    }, 6000);
  });

  // 4. File input preview for images
  const imageInput = document.querySelector('input[type="file"][name="image"], input[type="file"][name="evidenceImage"]');
  if (imageInput) {
    imageInput.addEventListener('change', function () {
      const file = this.files[0];
      if (file) {
        // Size validation (5MB max)
        if (file.size > 5 * 1024 * 1024) {
          alert('File size exceeds 5MB limit. Please select a smaller image.');
          this.value = '';
          return;
        }

        const previewContainer = document.getElementById('imagePreviewContainer');
        const previewImage = document.getElementById('imagePreview');
        if (previewContainer && previewImage) {
          const reader = new FileReader();
          reader.onload = (e) => {
            previewImage.src = e.target.result;
            previewContainer.classList.remove('d-none');
          };
          reader.readAsDataURL(file);
        }
      }
    });
  }

  // 5. Confirmation dialogs for delete or irreversible actions
  const confirmActions = document.querySelectorAll('[data-confirm]');
  confirmActions.forEach((el) => {
    el.addEventListener('click', (e) => {
      const message = el.getAttribute('data-confirm') || 'Are you sure you want to proceed?';
      if (!confirm(message)) {
        e.preventDefault();
      }
    });
  });
});
